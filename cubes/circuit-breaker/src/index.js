export class CircuitBreakerError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'CircuitBreakerError';
    this.code = code;
    this.retryable = options.retryable === true;
    this.probe = options.probe === true;
    Object.freeze(this);
  }
}

function freezeSnapshot(value) { return Object.freeze({ ...value }); }

export class FakeClock {
  constructor(startMs = 0) {
    if (!Number.isSafeInteger(startMs) || startMs < 0) throw new RangeError('startMs must be a safe integer >= 0');
    this.time = startMs;
  }
  now() { return this.time; }
  advance(ms) {
    if (!Number.isSafeInteger(ms) || ms < 0) throw new RangeError('ms must be a safe integer >= 0');
    this.time += ms;
    return this.time;
  }
}

export class CircuitBreaker {
  constructor(options = {}) {
    const {
      failureThreshold = 5,
      successThreshold = 2,
      cooldownMs = 30_000,
      halfOpenMaxProbes = 1,
      clock = { now: () => Date.now() },
      isFailure = error => error?.retryable === true || error?.code === 'RETRYABLE' || error?.code === 'TIMEOUT',
    } = options;
    if (!Number.isSafeInteger(failureThreshold) || failureThreshold < 1) throw new RangeError('failureThreshold must be a safe integer >= 1');
    if (!Number.isSafeInteger(successThreshold) || successThreshold < 1) throw new RangeError('successThreshold must be a safe integer >= 1');
    if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 0) throw new RangeError('cooldownMs must be a safe integer >= 0');
    if (!Number.isSafeInteger(halfOpenMaxProbes) || halfOpenMaxProbes < 1) throw new RangeError('halfOpenMaxProbes must be a safe integer >= 1');
    if (!clock || typeof clock.now !== 'function') throw new TypeError('clock must implement now()');
    if (typeof isFailure !== 'function') throw new TypeError('isFailure must be a function');
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.cooldownMs = cooldownMs;
    this.halfOpenMaxProbes = halfOpenMaxProbes;
    this.clock = clock;
    this.isFailure = isFailure;
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.openedAt = null;
    this.probes = 0;
    this.lifecycleClosed = false;
    this.stats = { calls: 0, successes: 0, failures: 0, rejections: 0, opens: 0, halfOpen: 0, resets: 0 };
  }

  getState() {
    if (this.lifecycleClosed) return 'CLOSED';
    if (this.state === 'OPEN' && this.clock.now() - this.openedAt >= this.cooldownMs) this.#enterHalfOpen();
    return this.state;
  }

  getStats() {
    return freezeSnapshot({
      state: this.getState(),
      failureCount: this.failures,
      successCount: this.successes,
      probes: this.probes,
      openedAt: this.openedAt,
      cooldownMs: this.cooldownMs,
      failureThreshold: this.failureThreshold,
      successThreshold: this.successThreshold,
      halfOpenMaxProbes: this.halfOpenMaxProbes,
      closed: this.lifecycleClosed,
      ...this.stats,
    });
  }

  canExecute() {
    if (this.lifecycleClosed) return false;
    const state = this.getState();
    if (state === 'CLOSED') return true;
    if (state === 'OPEN') return false;
    return this.probes < this.halfOpenMaxProbes;
  }

  reset() {
    if (this.lifecycleClosed) return;
    this.#setClosed();
    this.stats.resets += 1;
  }

  close() {
    this.lifecycleClosed = true;
  }

  async execute(operation, options = {}) {
    if (typeof operation !== 'function') throw new TypeError('operation must be a function');
    if (this.lifecycleClosed) throw new CircuitBreakerError('CLOSED', 'Circuit breaker is closed for new operations');
    const state = this.getState();
    if (state === 'OPEN') {
      this.stats.rejections += 1;
      throw new CircuitBreakerError('OPEN', 'Circuit breaker is open', { retryable: true });
    }
    if (state === 'HALF_OPEN') {
      if (this.probes >= this.halfOpenMaxProbes) {
        this.stats.rejections += 1;
        throw new CircuitBreakerError('PROBE_LIMIT', 'Half-open probe limit reached', { retryable: true, probe: true });
      }
      this.probes += 1;
    }
    if (options.signal?.aborted) {
      if (state === 'HALF_OPEN') this.probes = Math.max(0, this.probes - 1);
      throw new CircuitBreakerError('CANCELLED', 'Circuit breaker operation cancelled', { cause: options.signal.reason, probe: state === 'HALF_OPEN' });
    }
    this.stats.calls += 1;
    try {
      const value = await operation({ signal: options.signal, state });
      this.#recordSuccess(state);
      return value;
    } catch (error) {
      this.#recordFailure(state, error);
      throw error;
    }
  }

  #recordSuccess(state) {
    this.stats.successes += 1;
    if (state === 'HALF_OPEN') {
      this.probes = Math.max(0, this.probes - 1);
      this.successes += 1;
      if (this.successes >= this.successThreshold) this.#setClosed();
      return;
    }
    this.failures = 0;
  }

  #recordFailure(state, error) {
    this.stats.failures += 1;
    if (!this.isFailure(error)) return;
    if (state === 'HALF_OPEN') {
      this.probes = Math.max(0, this.probes - 1);
      this.#setOpen();
      return;
    }
    this.failures += 1;
    if (this.failures >= this.failureThreshold) this.#setOpen();
  }

  #enterHalfOpen() {
    if (this.state !== 'OPEN') return;
    this.state = 'HALF_OPEN';
    this.successes = 0;
    this.probes = 0;
    this.stats.halfOpen += 1;
  }

  #setOpen() {
    if (this.state !== 'OPEN') this.stats.opens += 1;
    this.state = 'OPEN';
    this.openedAt = this.clock.now();
    this.successes = 0;
    this.probes = 0;
  }

  #setClosed() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.openedAt = null;
    this.probes = 0;
  }
}
