const LEVELS = Object.freeze({ trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 });
const LEVEL_NAMES = Object.freeze(Object.keys(LEVELS));

export class LoggerCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'LoggerCubeError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
  }
}

function assertLevel(level) {
  if (!Object.hasOwn(LEVELS, level)) throw new LoggerCubeError('INVALID_LEVEL', `unknown log level: ${level}`);
}

function normalizeError(error) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { name: 'Error', message: String(error), stack: undefined };
}

function safeClone(value, depth = 0, seen = new WeakSet()) {
  if (depth > 6) return '[MaxDepth]';
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'bigint') return `${value}n`;
    if (typeof value === 'symbol') return String(value);
    if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
    return value;
  }
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 100).map(item => safeClone(item, depth + 1, seen));
  const out = {};
  for (const key of Object.keys(value).slice(0, 100)) out[key] = safeClone(value[key], depth + 1, seen);
  return out;
}

export class InMemorySink {
  constructor({ maxRecords = 1000 } = {}) {
    if (!Number.isSafeInteger(maxRecords) || maxRecords < 1) throw new LoggerCubeError('INVALID_MAX_RECORDS', 'maxRecords must be >= 1');
    this.maxRecords = maxRecords;
    this.records = [];
  }

  write(record) {
    this.records.push(record);
    if (this.records.length > this.maxRecords) this.records.splice(0, this.records.length - this.maxRecords);
  }

  flush() { return undefined; }
  close() { return undefined; }
  snapshot() { return this.records.slice(); }
}

export class ConsoleSink {
  constructor({ consoleLike = console } = {}) {
    if (!consoleLike || typeof consoleLike.error !== 'function' || typeof consoleLike.warn !== 'function' || typeof consoleLike.info !== 'function') {
      throw new LoggerCubeError('INVALID_CONSOLE', 'consoleLike must provide error, warn and info');
    }
    this.consoleLike = consoleLike;
  }

  write(record) {
    const line = JSON.stringify(record);
    if (record.level === 'error' || record.level === 'fatal') this.consoleLike.error(line);
    else if (record.level === 'warn') this.consoleLike.warn(line);
    else this.consoleLike.info(line);
  }

  flush() { return undefined; }
  close() { return undefined; }
}

export class Logger {
  constructor({
    minLevel = 'info',
    sinks = [],
    context = {},
    clock = { wallNow: () => new Date().toISOString(), monoNow: () => Number(process.hrtime.bigint()) / 1e6 },
    maxRecordBytes = 64 * 1024,
    onSinkError = () => {}
  } = {}) {
    assertLevel(minLevel);
    if (!Array.isArray(sinks)) throw new LoggerCubeError('INVALID_SINKS', 'sinks must be an array');
    if (!clock || typeof clock.wallNow !== 'function' || typeof clock.monoNow !== 'function') throw new LoggerCubeError('INVALID_CLOCK', 'clock must provide wallNow and monoNow');
    if (!Number.isSafeInteger(maxRecordBytes) || maxRecordBytes < 256) throw new LoggerCubeError('INVALID_MAX_RECORD_BYTES', 'maxRecordBytes must be >= 256');
    if (typeof onSinkError !== 'function') throw new LoggerCubeError('INVALID_SINK_ERROR_HANDLER', 'onSinkError must be a function');
    this.minLevel = minLevel;
    this.sinks = sinks.slice();
    this.context = safeClone(context);
    this.clock = clock;
    this.maxRecordBytes = maxRecordBytes;
    this.onSinkError = onSinkError;
  }

  child(extraContext = {}) {
    return new Logger({ minLevel: this.minLevel, sinks: this.sinks, context: { ...this.context, ...safeClone(extraContext) }, clock: this.clock, maxRecordBytes: this.maxRecordBytes, onSinkError: this.onSinkError });
  }

  enabled(level) {
    assertLevel(level);
    return LEVELS[level] >= LEVELS[this.minLevel];
  }

  log(level, message, fields = {}) {
    assertLevel(level);
    if (!this.enabled(level)) return null;
    if (typeof message !== 'string') message = String(message);
    const record = {
      version: 1,
      ts: this.clock.wallNow(),
      monoMs: this.clock.monoNow(),
      level,
      message,
      context: safeClone(this.context),
      fields: safeClone(fields)
    };
    if (record.fields && record.fields.error) record.fields.error = normalizeError(record.fields.error);
    let encoded;
    try { encoded = JSON.stringify(record); } catch (error) { throw new LoggerCubeError('SERIALIZATION_FAILED', 'log record could not be serialized', { cause: error }); }
    if (Buffer.byteLength(encoded, 'utf8') > this.maxRecordBytes) {
      throw new LoggerCubeError('RECORD_TOO_LARGE', 'log record exceeds configured size limit');
    }
    for (const sink of this.sinks) {
      try { sink.write(record); } catch (error) { this.onSinkError(error, sink, record); }
    }
    return record;
  }

  trace(message, fields) { return this.log('trace', message, fields); }
  debug(message, fields) { return this.log('debug', message, fields); }
  info(message, fields) { return this.log('info', message, fields); }
  warn(message, fields) { return this.log('warn', message, fields); }
  error(message, fields) { return this.log('error', message, fields); }
  fatal(message, fields) { return this.log('fatal', message, fields); }

  async flush() {
    const results = [];
    for (const sink of this.sinks) if (typeof sink.flush === 'function') results.push(await sink.flush());
    return results;
  }

  async close() {
    const results = [];
    for (const sink of this.sinks) if (typeof sink.close === 'function') results.push(await sink.close());
    return results;
  }
}

export { LEVELS, LEVEL_NAMES, normalizeError };
