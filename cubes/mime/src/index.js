import { randomBytes } from 'node:crypto';

export class MimeError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'MimeError';
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') return Buffer.from(value);
  throw new TypeError('chunk must be a string, Buffer, or Uint8Array');
}

function assertBoundary(boundary) {
  if (typeof boundary !== 'string' || boundary.length < 1 || boundary.length > 70 || !/^[A-Za-z0-9'()+_,-.\/:=? ]+$/.test(boundary)) {
    throw new MimeError('INVALID_BOUNDARY', 'Invalid multipart boundary');
  }
  return boundary;
}

export function parseMimeType(value) {
  if (typeof value !== 'string') throw new MimeError('INVALID_MIME_TYPE', 'MIME type must be a string');
  const [typePart, ...parameterParts] = value.split(';');
  const type = typePart.trim().toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(type)) throw new MimeError('INVALID_MIME_TYPE', `Invalid MIME type: ${value}`);
  const parameters = {};
  for (const item of parameterParts) {
    const index = item.indexOf('=');
    if (index <= 0) continue;
    const key = item.slice(0, index).trim().toLowerCase();
    let parameter = item.slice(index + 1).trim();
    if (parameter.startsWith('"') && parameter.endsWith('"')) parameter = parameter.slice(1, -1).replace(/\\([\\"])/g, '$1');
    parameters[key] = parameter;
  }
  return Object.freeze({ type, parameters: Object.freeze(parameters) });
}

function parseHeaders(block, maxHeaders) {
  if (Buffer.byteLength(block) > maxHeaders) throw new MimeError('HEADERS_TOO_LARGE', `Multipart headers exceed ${maxHeaders} bytes`);
  const headers = {};
  for (const line of block.split('\r\n')) {
    if (!line) continue;
    const index = line.indexOf(':');
    if (index <= 0) throw new MimeError('MALFORMED_HEADERS', 'Malformed multipart header');
    const name = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (headers[name]) headers[name] = `${headers[name]}, ${value}`;
    else headers[name] = value;
  }
  return Object.freeze(headers);
}

function parseContentDisposition(value) {
  if (!value) return Object.freeze({});
  const [type, ...parts] = value.split(';');
  const result = { type: type.trim().toLowerCase() };
  for (const item of parts) {
    const index = item.indexOf('=');
    if (index <= 0) continue;
    const key = item.slice(0, index).trim().toLowerCase();
    let field = item.slice(index + 1).trim();
    if (field.startsWith('"') && field.endsWith('"')) field = field.slice(1, -1).replace(/\\([\\"])/g, '$1');
    result[key] = field;
  }
  return Object.freeze(result);
}

async function* asChunks(source) {
  if (typeof source === 'string' || Buffer.isBuffer(source) || source instanceof Uint8Array) {
    yield toBuffer(source);
    return;
  }
  if (!source || typeof source[Symbol.asyncIterator] !== 'function') throw new TypeError('source must be an async iterable or byte sequence');
  for await (const chunk of source) yield toBuffer(chunk);
}

export async function parseMultipart(source, options = {}) {
  const boundary = assertBoundary(options.boundary);
  const maxTotalBytes = options.maxTotalBytes ?? 16 * 1024 * 1024;
  const maxPartBytes = options.maxPartBytes ?? 8 * 1024 * 1024;
  const maxHeaderBytes = options.maxHeaderBytes ?? 64 * 1024;
  const signal = options.signal;
  for (const [name, value] of [['maxTotalBytes', maxTotalBytes], ['maxPartBytes', maxPartBytes], ['maxHeaderBytes', maxHeaderBytes]]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a safe integer >= 1`);
  }

  const marker = Buffer.from(`--${boundary}`);
  const bodyMarker = Buffer.from(`\r\n--${boundary}`);
  let buffer = Buffer.alloc(0);
  let total = 0;
  let state = 'preamble';
  let headers = null;
  const parts = [];

  const append = chunk => {
    total += chunk.length;
    if (total > maxTotalBytes) throw new MimeError('BODY_TOO_LARGE', `Multipart body exceeds ${maxTotalBytes} bytes`, { statusCode: 413 });
    buffer = Buffer.concat([buffer, chunk]);
  };

  const find = needle => buffer.indexOf(needle);

  for await (const chunk of asChunks(source)) {
    if (signal?.aborted) throw signal.reason ?? new MimeError('CANCELLED', 'Multipart parsing cancelled', { statusCode: 499 });
    append(chunk);

    while (true) {
      if (state === 'preamble') {
        const start = find(marker);
        if (start < 0) { if (buffer.length > marker.length + 2) buffer = buffer.subarray(buffer.length - marker.length - 2); break; }
        buffer = buffer.subarray(start + marker.length);
        if (buffer.length < 2) break;
        if (buffer.subarray(0, 2).equals(Buffer.from('--'))) return parts;
        if (!buffer.subarray(0, 2).equals(Buffer.from('\r\n'))) throw new MimeError('MALFORMED_MULTIPART', 'Multipart boundary must be followed by CRLF');
        buffer = buffer.subarray(2);
        state = 'headers';
      }

      if (state === 'headers') {
        const end = find(Buffer.from('\r\n\r\n'));
        if (end < 0) { if (buffer.length > maxHeaderBytes) throw new MimeError('HEADERS_TOO_LARGE', `Multipart headers exceed ${maxHeaderBytes} bytes`); break; }
        headers = parseHeaders(buffer.subarray(0, end).toString('utf8'), maxHeaderBytes);
        buffer = buffer.subarray(end + 4);
        state = 'body';
      }

      if (state === 'body') {
        const boundaryIndex = find(bodyMarker);
        if (boundaryIndex < 0) {
          if (buffer.length > maxPartBytes + bodyMarker.length) throw new MimeError('PART_TOO_LARGE', `Multipart part exceeds ${maxPartBytes} bytes`, { statusCode: 413 });
          break;
        }
        const data = buffer.subarray(0, boundaryIndex);
        if (data.length > maxPartBytes) throw new MimeError('PART_TOO_LARGE', `Multipart part exceeds ${maxPartBytes} bytes`, { statusCode: 413 });
        const frozenHeaders = headers;
        const disposition = parseContentDisposition(frozenHeaders['content-disposition']);
        const contentType = frozenHeaders['content-type'] ?? 'text/plain';
        const part = { headers: frozenHeaders, disposition, contentType, size: data.length, data: Buffer.from(data) };
        if (disposition.name && !disposition.filename) part.text = data.toString('utf8');
        parts.push(Object.freeze(part));
        buffer = buffer.subarray(boundaryIndex + 2); // leave --boundary for preamble logic
        state = 'preamble';
      }
    }
  }

  throw new MimeError('INCOMPLETE_MULTIPART', 'Multipart body ended before the closing boundary');
}

export function buildMultipart(parts, options = {}) {
  if (!Array.isArray(parts)) throw new TypeError('parts must be an array');
  const boundary = assertBoundary(options.boundary ?? `----sovereign-${randomBytes(12).toString('hex')}`);
  const chunks = [];
  for (const part of parts) {
    if (!part || typeof part !== 'object') throw new TypeError('multipart part must be an object');
    const name = String(part.name ?? '');
    if (!name) throw new MimeError('INVALID_PART', 'Multipart part name is required');
    const headers = [];
    let disposition = `form-data; name="${name.replace(/(["\\])/g, '\\$1')}"`;
    if (part.filename !== undefined) disposition += `; filename="${String(part.filename).replace(/(["\\])/g, '\\$1')}"`;
    headers.push(`Content-Disposition: ${disposition}`);
    if (part.contentType) headers.push(`Content-Type: ${part.contentType}`);
    const data = toBuffer(part.data ?? part.value ?? '');
    chunks.push(Buffer.from(`--${boundary}\r\n${headers.join('\r\n')}\r\n\r\n`));
    chunks.push(data);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(chunks);
  return Object.freeze({ boundary, contentType: `multipart/form-data; boundary=${boundary}`, body, contentLength: body.length });
}
