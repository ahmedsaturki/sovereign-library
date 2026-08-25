export class UrlError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'UrlError';
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

function assertBounded(value, name, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError('maxBytes must be a safe integer >= 1');
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  if (Buffer.byteLength(value, 'utf8') > maxBytes) throw new UrlError('INPUT_TOO_LARGE', `${name} exceeds ${maxBytes} bytes`, { statusCode: 413 });
}

export function parseUrl(value, options = {}) {
  const maxBytes = options.maxBytes ?? 1_048_576;
  assertBounded(value, 'url', maxBytes);
  try {
    const url = new URL(value, options.base);
    return Object.freeze({ href: url.href, protocol: url.protocol, username: url.username, password: url.password, host: url.host, hostname: url.hostname, port: url.port, pathname: url.pathname, search: url.search, hash: url.hash });
  } catch (cause) {
    throw new UrlError('INVALID_URL', 'Invalid URL', { cause });
  }
}

export function encodeURIComponentSafe(value, options = {}) {
  assertBounded(value, 'value', options.maxBytes ?? 1_048_576);
  return encodeURIComponent(value);
}

export function decodeURIComponentStrict(value, options = {}) {
  assertBounded(value, 'value', options.maxBytes ?? 1_048_576);
  try { return decodeURIComponent(value); }
  catch (cause) { throw new UrlError('INVALID_PERCENT_ENCODING', 'Invalid percent encoding', { cause }); }
}

export function decodeURIComponentTolerant(value, options = {}) {
  assertBounded(value, 'value', options.maxBytes ?? 1_048_576);
  try { return decodeURIComponent(value); } catch { return String(value).replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))); }
}

export function parseQuery(value, options = {}) {
  assertBounded(value, 'query', options.maxBytes ?? 1_048_576);
  const source = String(value).replace(/^\?/, '');
  const params = new URLSearchParams(source);
  const out = {};
  for (const [key, val] of params) {
    if (out[key] === undefined) out[key] = [val];
    else out[key].push(val);
  }
  return Object.freeze(Object.fromEntries(Object.entries(out).map(([key, values]) => [key, Object.freeze([...values])])));
}

export function buildQuery(input, options = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('query input must be an object');
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(input)) {
    if (Array.isArray(raw)) for (const value of raw) params.append(key, String(value));
    else if (raw !== undefined && raw !== null) params.append(key, String(raw));
  }
  const output = params.toString();
  assertBounded(output, 'query', options.maxBytes ?? 1_048_576);
  return output;
}

export function formEncode(input, options = {}) { return buildQuery(input, options); }
export function formDecode(value, options = {}) { return parseQuery(value, options); }

export function utf8Encode(value, options = {}) {
  assertBounded(value, 'value', options.maxBytes ?? 1_048_576);
  return new TextEncoder().encode(value);
}

export function utf8Decode(bytes, options = {}) {
  const buffer = bytes instanceof Uint8Array ? bytes : Buffer.from(bytes);
  if (buffer.byteLength > (options.maxBytes ?? 1_048_576)) throw new UrlError('INPUT_TOO_LARGE', 'bytes exceed maximum size', { statusCode: 413 });
  try { return new TextDecoder('utf-8', { fatal: options.fatal === true }).decode(buffer); }
  catch (cause) { throw new UrlError('INVALID_UTF8', 'Invalid UTF-8 data', { cause }); }
}

function base64Bytes(bytes) { return Buffer.from(bytes instanceof Uint8Array ? bytes : Buffer.from(bytes)); }

export function base64Encode(value, options = {}) {
  const bytes = typeof value === 'string' ? utf8Encode(value, options) : base64Bytes(value);
  return bytes.toString('base64');
}

export function base64Decode(value, options = {}) {
  assertBounded(value, 'base64', options.maxBytes ?? 1_048_576);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw new UrlError('INVALID_BASE64', 'Invalid Base64 input');
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

export function base64UrlEncode(value, options = {}) { return base64Encode(value, options).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, ''); }

export function base64UrlDecode(value, options = {}) {
  assertBounded(value, 'base64url', options.maxBytes ?? 1_048_576);
  if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) throw new UrlError('INVALID_BASE64URL', 'Invalid Base64URL input');
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return base64Decode(padded, options);
}

export function encodePathSegment(value, options = {}) {
  return encodeURIComponentSafe(value, options);
}

export function decodePathSegment(value, options = {}) {
  return decodeURIComponentStrict(value, options);
}
