import {RealClock} from './clock.js';

function assertSafeIntegerOrInfinity(value, name, {min = 0} = {}) {
  if (value !== Infinity && (!Number.isSafeInteger(value) || value < min)) throw new RangeError(`${name} must be a safe integer >= ${min} or Infinity`);
}

function snapshot(value) { return Object.freeze(value); }

export class RetryError extends Error {
  constructor(code, message, options = {}) {
    super(message, {cause: options.cause});
    this.name = 'RetryError';
    this.code = code;
    this.attempts = options.attempts ?? 0;
    this.retryable = options.retryable === true;
    this.timedOut = options.timedOut === true;
    this.cancelled = options.cancelled === true;
    this.lastError = options.lastError;
    Object.freeze(this);
  }
}

function isAbortError(error) { return error?.name === 'AbortError' || error?.code === 'ABORT_ERR'; }

export function createRetryPolicy(options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 100,
    backoff = 'exponential',
    factor = 2,
    maxDelayMs = 30_000,
    jitter = 'none',
    random = Math.random,
    totalBudgetMs = Infinity,
    retryable = error => error?.retryable === true || error?.code === 'RETRYABLE',
  } = options;

  assertSafeIntegerOrInfinity(maxAttempts, 'maxAttempts', {min: 1});
  assertSafeIntegerOrInfinity(baseDelayMs, 'baseDelayMs');
  assertSafeIntegerOrInfinity(maxDelayMs, 'maxDelayMs');
  assertSafeIntegerOrInfinity(totalBudgetMs, 'totalBudgetMs');
  if (!['fixed', 'linear', 'exponential'].includes(backoff)) throw new TypeError('backoff must be fixed, linear, or exponential');
  if (!Number.isFinite(factor) || factor < 1) throw new RangeError('factor must be a finite number >= 1');
  if (!['none', 'full', 'bounded'].includes(jitter)) throw new TypeError('jitter must be none, full, or bounded');
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  if (typeof retryable !== 'function') throw new TypeError('retryable must be a function');

  function rawDelay(attempt) {
    if (backoff === 'fixed') return baseDelayMs;
    if (backoff === 'linear') return baseDelayMs * attempt;
    return baseDelayMs * (factor ** Math.max(0, attempt - 1));
  }

  function delayFor(attempt) {
    const capped = Math.min(maxDelayMs, rawDelay(attempt));
    if (jitter === 'none') return Math.max(0, Math.round(capped));
    const sample = Math.min(1, Math.max(0, Number(random())));
    if (jitter === 'full') return Math.max(0, Math.round(capped * sample));
    return Math.max(0, Math.round(capped / 2 + (capped / 2) * sample));
  }

  return Object.freeze({
    maxAttempts, baseDelayMs, backoff, factor, maxDelayMs, jitter, totalBudgetMs,
    retryable,
    delayFor,
  });
}

function delay(clock, ms, signal) {
  if (ms <= 0) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timer = clock.setTimeout(() => {
      if (removeAbort) removeAbort();
      resolve();
    }, ms);
    const onAbort = () => {
      clock.clearTimeout(timer);
      if (removeAbort) removeAbort();
      reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
    };
    let removeAbort = null;
    if (signal) {
      signal.addEventListener('abort', onAbort, {once: true});
      removeAbort = () => signal.removeEventListener('abort', onAbort);
    }
  });
}

async function runWithAttemptTimeout(operation, attempt, attemptTimeoutMs, parentSignal, clock) {
  const controller = new AbortController();
  let removeParent = null;
  if (parentSignal) {
    const forward = () => controller.abort(parentSignal.reason);
    if (parentSignal.aborted) controller.abort(parentSignal.reason);
    else {
      parentSignal.addEventListener('abort', forward, {once: true});
      removeParent = () => parentSignal.removeEventListener('abort', forward);
    }
  }

  let timer = null;
  let timedOut = false;
  try {
    const work = Promise.resolve().then(() => operation({attempt, signal: controller.signal}));
    const guarded = attemptTimeoutMs === Infinity ? work : new Promise((resolve, reject) => {
      timer = clock.setTimeout(() => {
        timedOut = true;
        controller.abort(new RetryError('TIMEOUT', `attempt ${attempt} timed out`, {attempts: attempt, timedOut: true, retryable: true}));
        reject(new RetryError('TIMEOUT', `attempt ${attempt} timed out`, {attempts: attempt, timedOut: true, retryable: true}));
      }, attemptTimeoutMs);
      work.then(resolve, reject);
    });
    return await guarded;
  } catch (error) {
    if (isAbortError(error) && parentSignal?.aborted) throw error;
    if (parentSignal?.aborted) throw parentSignal.reason ?? error;
    if (timedOut) throw error;
    throw error;
  } finally {
    if (timer !== null) clock.clearTimeout(timer);
    if (removeParent) removeParent();
  }
}

export class RetryRunner {
  constructor(policy = createRetryPolicy(), options = {}) {
    this.policy = policy;
    this.clock = options.clock ?? new RealClock();
    if (!this.clock || typeof this.clock.now !== 'function' || typeof this.clock.setTimeout !== 'function' || typeof this.clock.clearTimeout !== 'function') throw new TypeError('clock must implement now(), setTimeout(), clearTimeout()');
    Object.freeze(this);
  }

  async run(operation, options = {}) {
    if (typeof operation !== 'function') throw new TypeError('operation must be a function');
    const signal = options.signal;
    const attemptTimeoutMs = options.attemptTimeoutMs ?? Infinity;
    assertSafeIntegerOrInfinity(attemptTimeoutMs, 'attemptTimeoutMs');
    const startedAt = this.clock.now();
    const attempts = [];

    for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt += 1) {
      if (signal?.aborted) throw new RetryError('CANCELLED', 'retry operation cancelled', {attempts: attempt - 1, cancelled: true, cause: signal.reason});
      const elapsedBefore = Math.max(0, this.clock.now() - startedAt);
      if (elapsedBefore > this.policy.totalBudgetMs) throw new RetryError('BUDGET_EXCEEDED', 'retry total budget exceeded', {attempts: attempt - 1, retryable: false});

      const attemptStarted = this.clock.now();
      try {
        const value = await runWithAttemptTimeout(operation, attempt, attemptTimeoutMs, signal, this.clock);
        attempts.push(snapshot({attempt, ok: true, elapsedMs: Math.max(0, this.clock.now() - attemptStarted)}));
        return Object.freeze({value, attempts: Object.freeze(attempts.slice()), totalElapsedMs: Math.max(0, this.clock.now() - startedAt)});
      } catch (error) {
        attempts.push(snapshot({attempt, ok: false, error, elapsedMs: Math.max(0, this.clock.now() - attemptStarted)}));
        if (signal?.aborted) throw new RetryError('CANCELLED', 'retry operation cancelled', {attempts: attempt, cancelled: true, cause: signal.reason ?? error, lastError: error});
        const canRetry = attempt < this.policy.maxAttempts && this.policy.retryable(error);
        if (!canRetry) throw new RetryError('RETRY_EXHAUSTED', `retry failed after ${attempt} attempt(s)`, {attempts: attempt, retryable: false, lastError: error, cause: error});
        const delayMs = this.policy.delayFor(attempt);
        const elapsedNow = Math.max(0, this.clock.now() - startedAt);
        if (elapsedNow + delayMs > this.policy.totalBudgetMs) throw new RetryError('BUDGET_EXCEEDED', 'retry total budget exceeded', {attempts: attempt, retryable: false, lastError: error, cause: error});
        attempts[attempts.length - 1] = snapshot({...attempts[attempts.length - 1], retry: true, delayMs});
        await delay(this.clock, delayMs, signal);
      }
    }
    throw new RetryError('RETRY_EXHAUSTED', 'retry attempts exhausted', {attempts: this.policy.maxAttempts});
  }
}
