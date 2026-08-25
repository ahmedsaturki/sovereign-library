import { spawn } from 'node:child_process';
import readline from 'node:readline';

const DEFAULT_LIMITS = Object.freeze({
  maxMessages: 64,
  maxMessageBytes: 64 * 1024,
  maxContextBytes: 1024 * 1024,
  maxOptionsBytes: 64 * 1024,
  maxOutputBytes: 512 * 1024,
  maxEventBytes: 64 * 1024,
  maxEvents: 4096,
  maxLineBytes: 128 * 1024,
  maxStderrBytes: 64 * 1024,
  timeoutMs: 120_000,
});

class InferenceError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'InferenceError';
    this.code = code;
    this.statusCode = options.statusCode ?? null;
    Object.freeze(this);
  }
}

const fail = (code, message, options = {}) => { throw new InferenceError(code, message, options); };
const isObject = value => value !== null && typeof value === 'object';
const byteLength = value => Buffer.byteLength(String(value), 'utf8');

function validatePlainObject(value, label) {
  if (!isObject(value) || Array.isArray(value)) fail('INVALID_CONFIG', `${label} must be an object`);
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_CONFIG', `${label} contains an accessor property`);
  }
}

function cloneJsonSafe(value, depth = 0, seen = new Set()) {
  if (depth > 16) fail('BOUNDS_EXCEEDED', 'Metadata nesting exceeds the configured bound');
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) fail('INVALID_REQUEST', 'Non-finite metadata values are not supported');
    return value;
  }
  if (seen.has(value)) fail('INVALID_REQUEST', 'Circular metadata is not supported');
  seen.add(value);
  if (Array.isArray(value)) {
    const out = value.map(item => cloneJsonSafe(item, depth + 1, seen));
    seen.delete(value);
    return Object.freeze(out);
  }
  validatePlainObject(value, 'metadata');
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = cloneJsonSafe(value[key], depth + 1, seen);
  seen.delete(value);
  return Object.freeze(out);
}

function normalizeLimits(input = {}) {
  validatePlainObject(input, 'limits');
  const limits = Object.freeze({ ...DEFAULT_LIMITS, ...input });
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_CONFIG', `${key} must be a positive safe integer`);
  }
  return limits;
}

function normalizeMessages(messages, limits) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > limits.maxMessages) fail('INVALID_REQUEST', 'Invalid message list');
  let totalBytes = 0;
  const normalized = messages.map((message, index) => {
    validatePlainObject(message, `messages[${index}]`);
    if (!['system', 'user', 'assistant'].includes(message.role)) fail('INVALID_REQUEST', `Unsupported role at message ${index}`);
    if (typeof message.content !== 'string') fail('INVALID_REQUEST', `Message ${index} content must be a string`);
    const contentBytes = byteLength(message.content);
    if (contentBytes > limits.maxMessageBytes) fail('BOUNDS_EXCEEDED', `Message ${index} exceeds its byte limit`);
    totalBytes += contentBytes;
    if (totalBytes > limits.maxContextBytes) fail('BOUNDS_EXCEEDED', 'Message context exceeds its byte limit');
    return Object.freeze({ role: message.role, content: message.content, metadata: message.metadata === undefined ? null : cloneJsonSafe(message.metadata) });
  });
  return Object.freeze(normalized);
}

function normalizeRequest(request, limits) {
  validatePlainObject(request, 'request');
  const messages = normalizeMessages(request.messages, limits);
  const generation = request.generation ?? {};
  validatePlainObject(generation, 'generation');
  const optionsJson = JSON.stringify(generation);
  if (byteLength(optionsJson) > limits.maxOptionsBytes) fail('BOUNDS_EXCEEDED', 'Generation options exceed their byte limit');
  const options = cloneJsonSafe(generation);
  return Object.freeze({ messages, generation: options, metadata: request.metadata === undefined ? null : cloneJsonSafe(request.metadata) });
}

function withTimeout(signal, timeoutMs) {
  const controller = new AbortController();
  let timeout = null;
  let settled = false;
  const cleanup = () => {
    if (settled) return;
    settled = true;
    if (timeout) clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  };
  const onAbort = () => controller.abort(signal.reason);
  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener('abort', onAbort, { once: true });
  timeout = setTimeout(() => controller.abort(new InferenceError('TIMEOUT', 'Inference timed out', { statusCode: 408 })), timeoutMs);
  return { signal: controller.signal, cleanup };
}

function normalizeResult(result, request, limits) {
  validatePlainObject(result, 'adapter result');
  if (typeof result.text !== 'string') fail('ADAPTER_PROTOCOL', 'Adapter result text must be a string');
  if (byteLength(result.text) > limits.maxOutputBytes) fail('BOUNDS_EXCEEDED', 'Adapter output exceeds the configured limit');
  const usage = result.usage === undefined ? null : cloneJsonSafe(result.usage);
  return Object.freeze({ status: 'completed', request, text: result.text, usage });
}

function createRuntime(config = {}) {
  validatePlainObject(config, 'config');
  const limits = normalizeLimits(config.limits ?? {});
  const adapter = config.adapter;
  if (!isObject(adapter)) fail('INVALID_CONFIG', 'adapter is required');
  if (typeof adapter.infer !== 'function' && typeof adapter.stream !== 'function') fail('INVALID_CONFIG', 'adapter must expose infer or stream');

  async function infer(input, options = {}) {
    const request = normalizeRequest(input, limits);
    const timed = withTimeout(options.signal, Math.min(options.timeoutMs ?? limits.timeoutMs, limits.timeoutMs));
    try {
      if (timed.signal.aborted) {
        const reason = timed.signal.reason;
        if (reason instanceof InferenceError && reason.code === 'TIMEOUT') throw reason;
        fail('CANCELLED', 'Inference was cancelled', { statusCode: 499, cause: reason });
      }
      if (typeof adapter.infer !== 'function') fail('ADAPTER_PROTOCOL', 'Adapter does not support synchronous inference');
      const result = await adapter.infer(request, { signal: timed.signal });
      return normalizeResult(result, request, limits);
    } catch (error) {
      if (error instanceof InferenceError) throw error;
      if (timed.signal.aborted) {
        const reason = timed.signal.reason;
        if (reason instanceof InferenceError && reason.code === 'TIMEOUT') throw reason;
        throw new InferenceError('CANCELLED', 'Inference was cancelled', { statusCode: 499, cause: reason });
      }
      throw new InferenceError('ADAPTER_FAILURE', 'Inference adapter failed', { cause: error });
    } finally {
      timed.cleanup();
    }
  }

  async function* stream(input, options = {}) {
    const request = normalizeRequest(input, limits);
    const timed = withTimeout(options.signal, Math.min(options.timeoutMs ?? limits.timeoutMs, limits.timeoutMs));
    let eventCount = 0;
    let totalBytes = 0;
    try {
      if (typeof adapter.stream !== 'function') {
        const result = await infer(request, options);
        yield Object.freeze({ type: 'start' });
        yield Object.freeze({ type: 'delta', text: result.text });
        yield Object.freeze({ type: 'done', text: result.text, usage: result.usage });
        return;
      }
      yield Object.freeze({ type: 'start' });
      const events = await adapter.stream(request, { signal: timed.signal });
      if (!events || typeof events[Symbol.asyncIterator] !== 'function') fail('ADAPTER_PROTOCOL', 'Adapter stream must be async iterable');
      let fullText = '';
      for await (const event of events) {
        if (timed.signal.aborted) {
          const reason = timed.signal.reason;
          if (reason instanceof InferenceError && reason.code === 'TIMEOUT') throw reason;
          fail('CANCELLED', 'Inference stream was cancelled', { statusCode: 499, cause: reason });
        }
        if (!isObject(event) || event.type !== 'delta' || typeof event.text !== 'string') fail('ADAPTER_PROTOCOL', 'Invalid stream event');
        const eventBytes = byteLength(event.text);
        if (eventBytes > limits.maxEventBytes) fail('BOUNDS_EXCEEDED', 'Stream event exceeds its byte limit');
        eventCount += 1;
        if (eventCount > limits.maxEvents) fail('BOUNDS_EXCEEDED', 'Stream event count exceeds its limit');
        totalBytes += eventBytes;
        if (totalBytes > limits.maxOutputBytes) fail('BOUNDS_EXCEEDED', 'Stream output exceeds its limit');
        fullText += event.text;
        yield Object.freeze({ type: 'delta', text: event.text });
      }
      yield Object.freeze({ type: 'done', text: fullText, usage: null });
    } catch (error) {
      if (error instanceof InferenceError) throw error;
      if (timed.signal.aborted) {
        const reason = timed.signal.reason;
        if (reason instanceof InferenceError && reason.code === 'TIMEOUT') throw reason;
        throw new InferenceError('CANCELLED', 'Inference stream was cancelled', { statusCode: 499, cause: reason });
      }
      throw new InferenceError('ADAPTER_FAILURE', 'Inference stream failed', { cause: error });
    } finally {
      timed.cleanup();
    }
  }

  return Object.freeze({ limits, infer, stream });
}

function createNdjsonProcessAdapter(config = {}) {
  validatePlainObject(config, 'process adapter config');
  if (typeof config.command !== 'string' || !config.command) fail('INVALID_CONFIG', 'command is required');
  const args = Array.isArray(config.args) ? config.args.map(String) : [];
  const cwd = config.cwd;
  const env = config.env ? { ...config.env } : undefined;
  const adapterLimits = Object.freeze({ ...DEFAULT_LIMITS, ...(config.limits ?? {}) });
  for (const [key, value] of Object.entries(adapterLimits)) if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_CONFIG', `${key} must be a positive safe integer`);

  const infer = request => new Promise((resolve, reject) => {
    const child = spawn(config.command, args, { cwd, env, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stderrBytes = 0;
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve(result);
    };
    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on('line', line => {
      if (byteLength(line) > adapterLimits.maxLineBytes) {
        child.kill();
        finish(new InferenceError('BOUNDS_EXCEEDED', 'NDJSON response line exceeds its bound'));
        return;
      }
      let message;
      try { message = JSON.parse(line); } catch (cause) { child.kill(); finish(new InferenceError('ADAPTER_PROTOCOL', 'Malformed NDJSON response', { cause })); return; }
      if (message?.type === 'result') finish(null, { text: message.text, usage: message.usage });
      else if (message?.type === 'error') finish(new InferenceError('ADAPTER_FAILURE', 'Provider process returned an error'));
      else finish(new InferenceError('ADAPTER_PROTOCOL', 'Unknown NDJSON response event'));
    });
    child.stderr.on('data', chunk => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > adapterLimits.maxStderrBytes) child.kill();
    });
    child.on('error', error => finish(new InferenceError('PROCESS_SPAWN', 'Inference process could not start', { cause: error })));
    child.on('exit', code => {
      rl.close();
      if (!settled && code !== 0) finish(new InferenceError('PROCESS_EXIT', 'Inference process exited unsuccessfully'));
      if (!settled) finish(new InferenceError('ADAPTER_PROTOCOL', 'Inference process exited without a result'));
    });
    child.stdin.on('error', error => finish(new InferenceError('PROCESS_IO', 'Inference process stdin failed', { cause: error })));
    const payload = JSON.stringify(request);
    if (byteLength(payload) > adapterLimits.maxContextBytes + adapterLimits.maxOptionsBytes) {
      child.kill(); finish(new InferenceError('BOUNDS_EXCEEDED', 'Encoded inference request exceeds its bound')); return;
    }
    child.stdin.end(`${payload}\n`);
  });

  return Object.freeze({ infer });
}

export { DEFAULT_LIMITS, InferenceError, createRuntime, createNdjsonProcessAdapter };
