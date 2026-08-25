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
  if (!/^[a-z0-9!#$&^_.+*-]+\/[a-z0-9!#$&^_.+*-]+$/.test(type)) throw new MimeError('INVALID_MIME_TYPE', `Invalid MIME type: ${value}`);
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
    headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
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

async function readBounded(source, maxTotalBytes, signal) {
  if (typeof source === 'string' || Buffer.isBuffer(source) || source instanceof Uint8Array) {
    const buffer = toBuffer(source);
    if (buffer.length > maxTotalBytes) throw new MimeError('BODY_TOO_LARGE', `Multipart body exceeds ${maxTotalBytes} bytes`, { statusCode: 413 });
    return buffer;
  }
  if (!source || typeof source[Symbol.asyncIterator] !== 'function') throw new TypeError('source must be an async iterable or byte sequence');
  const chunks = [];
  let total = 0;
  for await (const value of source) {
    if (signal?.aborted) throw signal.reason ?? new MimeError('CANCELLED', 'Multipart parsing cancelled', { statusCode: 499 });
    const chunk = toBuffer(value);
    total += chunk.length;
    if (total > maxTotalBytes) throw new MimeError('BODY_TOO_LARGE', `Multipart body exceeds ${maxTotalBytes} bytes`, { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

export async function parseMultipart(source, options = {}) {
  const boundary = assertBoundary(options.boundary);
  const maxTotalBytes = options.maxTotalBytes ?? 16 * 1024 * 1024;
  const maxPartBytes = options.maxPartBytes ?? 8 * 1024 * 1024;
  const maxHeaderBytes = options.maxHeaderBytes ?? 64 * 1024;
  for (const [name, value] of [['maxTotalBytes', maxTotalBytes], ['maxPartBytes', maxPartBytes], ['maxHeaderBytes', maxHeaderBytes]]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a safe integer >= 1`);
  }

  const body = await readBounded(source, maxTotalBytes, options.signal);
  const marker = Buffer.from(`--${boundary}`);
  const delimiter = Buffer.from(`\r\n--${boundary}`);
  const headerEnd = Buffer.from('\r\n\r\n');
  const parts = [];
  let cursor = body.indexOf(marker);
  if (cursor < 0) throw new MimeError('MALFORMED_MULTIPART', 'Opening multipart boundary was not found');

  while (cursor >= 0) {
    const afterMarker = cursor + marker.length;
    if (body.length < afterMarker + 2) throw new MimeError('INCOMPLETE_MULTIPART', 'Multipart boundary is incomplete');
    if (body.subarray(afterMarker, afterMarker + 2).equals(Buffer.from('--'))) return Object.freeze(parts);
    if (!body.subarray(afterMarker, afterMarker + 2).equals(Buffer.from('\r\n'))) throw new MimeError('MALFORMED_MULTIPART', 'Multipart boundary must be followed by CRLF');

    const headerStart = afterMarker + 2;
    const headersEndIndex = body.indexOf(headerEnd, headerStart);
    if (headersEndIndex < 0) throw new MimeError('INCOMPLETE_MULTIPART', 'Multipart headers are incomplete');
    const headers = parseHeaders(body.subarray(headerStart, headersEndIndex).toString('utf8'), maxHeaderBytes);
    const dataStart = headersEndIndex + headerEnd.length;
    const nextBoundary = body.indexOf(delimiter, dataStart);
    if (nextBoundary < 0) throw new MimeError('INCOMPLETE_MULTIPART', 'Multipart closing boundary was not found');
    const data = body.subarray(dataStart, nextBoundary);
    if (data.length > maxPartBytes) throw new MimeError('PART_TOO_LARGE', `Multipart part exceeds ${maxPartBytes} bytes`, { statusCode: 413 });
    const disposition = parseContentDisposition(headers['content-disposition']);
    const contentType = headers['content-type'] ?? 'text/plain';
    const part = { headers, disposition, contentType, size: data.length, data: Buffer.from(data) };
    if (disposition.name && !disposition.filename) part.text = data.toString('utf8');
    parts.push(Object.freeze(part));
    cursor = nextBoundary + 2;
  }
  throw new MimeError('INCOMPLETE_MULTIPART', 'Multipart closing boundary was not found');
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
