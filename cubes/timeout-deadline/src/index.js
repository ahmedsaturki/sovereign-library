export class TimeoutError extends Error {
  constructor(message = 'Operation timed out', options = {}) {
    super(message, { cause: options.cause });
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT';
    this.deadlineAt = options.deadlineAt ?? null;
    this.elapsedMs = options.elapsedMs ?? null;
    Object.freeze(this);
  }
}

function assertSafeMs(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a safe integer >= 0`);
  }
}

export class RealClock {
  now() {
    return Math.floor(globalThis.performance?.now?.() ?? (Date.now()));
  }
}

export class FakeClock {
  constructor(startMs = 0) {
    assertSafeMs(startMs, 'startMs');
    this.time = startMs;
  }

  now() {
    return this.time;
  }

  advance(ms) {
    assertSafeMs(ms, 'ms');
    this.time += ms;
    return this.time;
  }
}

export class Deadline {
  constructor(deadlineAt, clock = new RealClock()) {
    assertSafeMs(deadlineAt, 'deadlineAt');
    if (!clock || typeof clock.now !== 'function') {
      throw new TypeError('clock must implement now()');
    }
    this.deadlineAt = deadlineAt;
    this.clock = clock;
    Object.freeze(this);
  }

  remainingMs() {
    return Math.max(0, this.deadlineAt - this.clock.now());
  }

  isExpired() {
    return this.remainingMs() === 0;
  }

  snapshot() {
    return Object.freeze({
      deadlineAt: this.deadlineAt,
      remainingMs: this.remainingMs(),
      expired: this.isExpired(),
    });
  }

  child(durationMs) {
    assertSafeMs(durationMs, 'durationMs');
    return new Deadline(Math.min(this.deadlineAt, this.clock.now() + durationMs), this.clock);
  }
}

export function createDeadline(durationMs, options = {}) {
  assertSafeMs(durationMs, 'durationMs');
  const clock = options.clock ?? new RealClock();
  if (!clock || typeof clock.now !== 'function') {
    throw new TypeError('clock must implement now()');
  }
  return new Deadline(clock.now() + durationMs, clock);
}

export function deadlineFromAbsolute(deadlineAt, options = {}) {
  return new Deadline(deadlineAt, options.clock ?? new RealClock());
}

function settleOnce(state, settle) {
  if (state.done) return false;
  state.done = true;
  settle();
  return true;
}

export async function withDeadline(operation, deadline, options = {}) {
  if (typeof operation !== 'function') throw new TypeError('operation must be a function');
  if (!(deadline instanceof Deadline)) throw new TypeError('deadline must be a Deadline');

  const parentSignal = options.signal ?? null;
  if (parentSignal?.aborted) {
    throw parentSignal.reason ?? new DOMException('The operation was aborted', 'AbortError');
  }

  const remaining = deadline.remainingMs();
  if (remaining === 0) {
    throw new TimeoutError('Operation deadline already expired', { deadlineAt: deadline.deadlineAt });
  }

  const controller = new AbortController();
  let timer = null;
  let removeParentAbort = null;
  const state = { done: false };

  const abortFromParent = () => controller.abort(parentSignal.reason);
  if (parentSignal) {
    parentSignal.addEventListener('abort', abortFromParent, { once: true });
    removeParentAbort = () => parentSignal.removeEventListener('abort', abortFromParent);
  }

  const cleanup = () => {
    if (timer !== null) clearTimeout(timer);
    removeParentAbort?.();
  };

  try {
    const operationPromise = Promise.resolve().then(() => operation({ signal: controller.signal, deadline }));
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        if (!settleOnce(state, () => controller.abort(new TimeoutError('Operation timed out', { deadlineAt: deadline.deadlineAt })) )) return;
        reject(new TimeoutError('Operation timed out', {
          deadlineAt: deadline.deadlineAt,
          elapsedMs: Math.max(0, deadline.clock.now() - (deadline.deadlineAt - remaining)),
        }));
      }, remaining);
    });

    return await Promise.race([operationPromise, timeoutPromise]).finally(cleanup);
  } finally {
    cleanup();
  }
}

export function sleepUntil(deadline, options = {}) {
  return withDeadline(() => new Promise(resolve => {
    const ms = deadline.remainingMs();
    const timer = setTimeout(resolve, ms);
    options.signal?.addEventListener('abort', () => clearTimeout(timer), { once: true });
  }), deadline, options);
}
