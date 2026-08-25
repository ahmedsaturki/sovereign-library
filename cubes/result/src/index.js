const RESULT_TAG = Symbol('SOVEREIGN_RESULT');

function freezeError(error) {
  if (!(error instanceof Error)) return error;
  Object.freeze(error);
  return error;
}

export class ResultError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'ResultError';
    this.code = code;
    this.retryable = options.retryable === true;
    this.cancelled = options.cancelled === true;
    this.timedOut = options.timedOut === true;
    this.details = options.details === undefined ? undefined : freezeSnapshot(options.details);
    freezeError(this);
  }
}

function freezeSnapshot(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  if (value instanceof Error) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeSnapshot(item, seen);
  } else {
    for (const child of Object.values(value)) freezeSnapshot(child, seen);
  }
  return Object.freeze(value);
}

function normalizeError(error, fallbackCode = 'UNKNOWN_ERROR') {
  if (error instanceof ResultError) return error;
  if (error instanceof Error) {
    return new ResultError(fallbackCode, error.message || fallbackCode, { cause: error });
  }
  return new ResultError(fallbackCode, typeof error === 'string' ? error : 'unknown error', { details: { value: error } });
}

function success(value) {
  return Object.freeze({ [RESULT_TAG]: true, ok: true, value });
}

function failure(error) {
  return Object.freeze({ [RESULT_TAG]: true, ok: false, error: normalizeError(error) });
}

function assertResult(value) {
  if (!value || value[RESULT_TAG] !== true) throw new TypeError('expected Sovereign Result');
  return value;
}

export const Result = Object.freeze({
  ok: success,
  err: failure,
  from(value) {
    if (value && value[RESULT_TAG] === true) return value;
    return success(value);
  },
  fromThrowable(fn, options = {}) {
    try {
      return success(fn());
    } catch (error) {
      return Object.freeze({ [RESULT_TAG]: true, ok: false, error: normalizeError(error, options.code || 'UNKNOWN_ERROR') });
    }
  },
  async fromPromise(promise, options = {}) {
    try {
      return success(await promise);
    } catch (error) {
      return Object.freeze({ [RESULT_TAG]: true, ok: false, error: normalizeError(error, options.code || 'UNKNOWN_ERROR') });
    }
  },
  is(value) {
    return !!value && value[RESULT_TAG] === true;
  },
  unwrap(value) {
    const result = assertResult(value);
    if (!result.ok) throw result.error;
    return result.value;
  },
  unwrapOr(value, fallback) {
    const result = assertResult(value);
    return result.ok ? result.value : fallback;
  },
  map(value, fn) {
    const result = assertResult(value);
    if (!result.ok) return result;
    return success(fn(result.value));
  },
  mapErr(value, fn) {
    const result = assertResult(value);
    if (result.ok) return result;
    return failure(fn(result.error));
  },
  andThen(value, fn) {
    const result = assertResult(value);
    if (!result.ok) return result;
    return assertResult(fn(result.value));
  },
  recover(value, fn) {
    const result = assertResult(value);
    if (result.ok) return result;
    return assertResult(fn(result.error));
  },
  match(value, handlers) {
    const result = assertResult(value);
    if (result.ok) return handlers.ok(result.value);
    return handlers.err(result.error);
  },
  ensure(value, predicate, error = new ResultError('VALIDATION_FAILED', 'result validation failed')) {
    const result = assertResult(value);
    if (!result.ok) return result;
    return predicate(result.value) ? result : failure(error);
  },
});

export const errors = Object.freeze({
  normalize: normalizeError,
  unknown(message = 'unknown error', details) {
    return new ResultError('UNKNOWN_ERROR', message, { details });
  },
  cancelled(message = 'operation cancelled', details) {
    return new ResultError('CANCELLED', message, { cancelled: true, details });
  },
  timedOut(message = 'operation timed out', details) {
    return new ResultError('TIMEOUT', message, { timedOut: true, retryable: true, details });
  },
  retryable(code, message, options = {}) {
    return new ResultError(code, message, { ...options, retryable: true });
  },
  validation(message, details) {
    return new ResultError('VALIDATION_FAILED', message, { details });
  },
});

export function serializeError(error) {
  const normalized = normalizeError(error);
  return Object.freeze({
    name: normalized.name,
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
    cancelled: normalized.cancelled,
    timedOut: normalized.timedOut,
    details: normalized.details,
    cause: normalized.cause instanceof Error ? serializeError(normalized.cause) : undefined,
  });
}

export { normalizeError };
