export class StreamError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'StreamError';
    this.code = code;
    this.operation = options.operation ?? null;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

const DEFAULT_MAX_CHUNK_BYTES = 1_048_576;

function normalizeOptions(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new StreamError('INVALID_OPTIONS', 'Stream options must be an object');
  }
  const maxChunkBytes = options.maxChunkBytes ?? DEFAULT_MAX_CHUNK_BYTES;
  if (!Number.isSafeInteger(maxChunkBytes) || maxChunkBytes < 1) {
    throw new StreamError('INVALID_LIMIT', 'maxChunkBytes must be a safe integer >= 1');
  }
  return Object.freeze({ maxChunkBytes });
}

function chunkSize(chunk) {
  if (typeof chunk === 'string') return Buffer.byteLength(chunk, 'utf8');
  if (chunk instanceof Uint8Array) return chunk.byteLength;
  try { return Buffer.byteLength(JSON.stringify(chunk), 'utf8'); }
  catch { return 0; }
}

function validateTransform(transform, index) {
  if (typeof transform !== 'function') throw new StreamError('INVALID_TRANSFORM', `Transform ${index} must be a function`);
}

export function createPipeline(source, transforms = [], options = {}) {
  const config = normalizeOptions(options);
  if (source === null || source === undefined || typeof source[Symbol.asyncIterator] !== 'function') {
    throw new StreamError('INVALID_SOURCE', 'Source must be an AsyncIterable');
  }
  if (!Array.isArray(transforms)) throw new StreamError('INVALID_TRANSFORMS', 'Transforms must be an array');
  transforms.forEach(validateTransform);

  return (async function* run() {
    let index = 0;
    try {
      for await (const input of source) {
        if (options.signal?.aborted) throw new StreamError('CANCELLED', 'Pipeline cancelled', { statusCode: 499 });
        if (chunkSize(input) > config.maxChunkBytes) {
          throw new StreamError('CHUNK_TOO_LARGE', `Input chunk exceeds ${config.maxChunkBytes} bytes`, { statusCode: 413 });
        }

        let current = input;
        for (let transformIndex = 0; transformIndex < transforms.length; transformIndex += 1) {
          if (options.signal?.aborted) throw new StreamError('CANCELLED', 'Pipeline cancelled', { statusCode: 499 });
          try {
            current = await transforms[transformIndex](current, { index, signal: options.signal ?? null });
          } catch (cause) {
            if (cause instanceof StreamError) throw cause;
            throw new StreamError('TRANSFORM_FAILED', `Transform ${transformIndex} failed`, { cause, operation: 'transform' });
          }
          if (current === undefined) continue;
          if (chunkSize(current) > config.maxChunkBytes) {
            throw new StreamError('CHUNK_TOO_LARGE', `Transform output exceeds ${config.maxChunkBytes} bytes`, { statusCode: 413 });
          }
        }

        index += 1;
        if (current !== undefined) yield current;
      }
    } catch (cause) {
      if (cause instanceof StreamError) throw cause;
      if (options.signal?.aborted) throw new StreamError('CANCELLED', 'Pipeline cancelled', { cause, statusCode: 499 });
      throw new StreamError('SOURCE_FAILED', 'Pipeline source failed', { cause, operation: 'source' });
    }
  })();
}

export async function runPipeline(source, transforms, sink, options = {}) {
  if (sink === null || typeof sink !== 'object' || typeof sink.write !== 'function') {
    throw new StreamError('INVALID_SINK', 'Sink must expose an async or sync write(chunk) function');
  }
  const pipeline = createPipeline(source, transforms, options);
  let count = 0;
  try {
    for await (const chunk of pipeline) {
      if (options.signal?.aborted) throw new StreamError('CANCELLED', 'Pipeline cancelled', { statusCode: 499 });
      try {
        await sink.write(chunk);
      } catch (cause) {
        throw new StreamError('SINK_FAILED', 'Pipeline sink failed', { cause, operation: 'sink' });
      }
      count += 1;
    }
    if (typeof sink.end === 'function') await sink.end();
    return Object.freeze({ chunks: count });
  } catch (cause) {
    try {
      if (typeof sink.fail === 'function') await sink.fail(cause);
    } catch {
      // Preserve the original pipeline failure; sink cleanup errors are secondary.
    }
    if (cause instanceof StreamError) throw cause;
    throw new StreamError('PIPELINE_FAILED', 'Pipeline failed', { cause, operation: 'pipeline' });
  }
}

export async function collect(source, options = {}) {
  const chunks = [];
  const maxChunks = options.maxChunks ?? 10_000;
  if (!Number.isSafeInteger(maxChunks) || maxChunks < 1) throw new StreamError('INVALID_LIMIT', 'maxChunks must be a safe integer >= 1');
  for await (const chunk of createPipeline(source, [], options)) {
    if (chunks.length >= maxChunks) throw new StreamError('BUFFER_LIMIT', `Collected chunk count exceeds ${maxChunks}`, { statusCode: 413 });
    chunks.push(chunk);
  }
  return chunks;
}

export { DEFAULT_MAX_CHUNK_BYTES };
