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
  if (Array.isArray(value)) for (const item of value) freezeSnapshot(item, seen);
  else for (const child of Object.values(value)) freezeSnapshot(child, seen);
  return Object.freeze(value);
}

function normalizeError(error, fallbackCode = 'UNKNOWN_ERROR') {
  if (error instanceof ResultError) return error;
  if (error instanceof Error) return new ResultError(fallbackCode, error.message || fallbackCode, { cause: error });
  return new ResultError(fallbackCode, typeof error === 'string' ? error : 'unknown error', { details: { value: error } });
}

function success(value) { return Object.freeze({ [RESULT_TAG]: true, ok: true, value }); }
function failure(error) { return Object.freeze({ [RESULT_TAG]: true, ok: false, error: normalizeError(error) }); }
function assertResult(value) {
  if (!value || value[RESULT_TAG] !== true) throw new TypeError('expected Sovereign Result');
  return value;
}

export const Result = Object.freeze({
  ok: success,
  err: failure,
  from(value) { return value && value[RESULT_TAG] === true ? value : success(value); },
  fromThrowable(fn, options = {}) {
    try { return success(fn()); }
    catch (error) { return failure(normalizeError(error, options.code || 'UNKNOWN_ERROR')); }
  },
  async fromPromise(promise, options = {}) {
    try { return success(await promise); }
    catch (error) { return failure(normalizeError(error, options.code || 'UNKNOWN_ERROR')); }
  },
  is(value) { return !!value && value[RESULT_TAG] === true; },
  unwrap(value) { const result = assertResult(value); if (!result.ok) throw result.error; return result.value; },
  unwrapOr(value, fallback) { const result = assertResult(value); return result.ok ? result.value : fallback; },
  map(value, fn) { const result = assertResult(value); return result.ok ? success(fn(result.value)) : result; },
  mapErr(value, fn) { const result = assertResult(value); return result.ok ? result : failure(fn(result.error)); },
  andThen(value, fn) { const result = assertResult(value); return result.ok ? assertResult(fn(result.value)) : result; },
  recover(value, fn) { const result = assertResult(value); return result.ok ? result : assertResult(fn(result.error)); },
  match(value, handlers) { const result = assertResult(value); return result.ok ? handlers.ok(result.value) : handlers.err(result.error); },
  ensure(value, predicate, error = new ResultError('UNKNOWN_ERROR', 'result validation failed')) {
    const result = assertResult(value);
    return result.ok ? (predicate(result.value) ? result : failure(error)) : result;
  },
});

export const errors = Object.freeze({
  normalize: normalizeError,
  unknown(message = 'unknown error', details) { return new ResultError('UNKNOWN_ERROR', message, { details }); },
  cancelled(message = 'operation cancelled', details) { return new ResultError('CANCELLED', message, { cancelled: true, details }); },
  timedOut(message = 'operation timed out', details) { return new ResultError('TIMEOUT', message, { timedOut: true, retryable: true, details }); },
  retryable(code, message, options = {}) { return new ResultError(code, message, { ...options, retryable: true }); },
  validation(message, details) { return new ResultError('VALIDATION_FAILED', message, { details }); },
});

export function serializeError(error, seen = new WeakSet()) {
  const source = error instanceof Error ? error : normalizeError(error);
  if (seen.has(source)) return Object.freeze({ name: source.name, code: source.code || 'UNKNOWN_ERROR', message: '[circular cause]', retryable: source.retryable === true, cancelled: source.cancelled === true, timedOut: source.timedOut === true });
  seen.add(source);
  return Object.freeze({
    name: source.name || 'Error',
    code: source.code || 'UNKNOWN_ERROR',
    message: source.message || 'unknown error',
    retryable: source.retryable === true,
    cancelled: source.cancelled === true,
    timedOut: source.timedOut === true,
    details: source.details,
    cause: source.cause instanceof Error ? serializeError(source.cause, seen) : undefined,
  });
}

export { normalizeError };
