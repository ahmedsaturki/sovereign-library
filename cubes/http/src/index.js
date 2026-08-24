import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

export class HttpCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'HttpCubeError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    this.cause = options.cause;
  }
}

function validateUrl(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpCubeError('INVALID_URL', 'URL must be a non-empty string');
  }

  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new HttpCubeError('INVALID_URL', 'URL is not valid', { cause: error });
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new HttpCubeError('UNSUPPORTED_PROTOCOL', `Unsupported URL protocol: ${url.protocol}`);
  }

  return url;
}

function normalizeHeaders(headers = {}) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    throw new HttpCubeError('INVALID_HEADERS', 'Headers must be an object');
  }

  const result = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!key || /[\r\n]/.test(key)) throw new HttpCubeError('INVALID_HEADER_NAME', `Invalid header name: ${key}`);
    if (value == null) continue;
    if (/[\r\n]/.test(String(value))) throw new HttpCubeError('INVALID_HEADER_VALUE', `Invalid header value for: ${key}`);
    result[key] = String(value);
  }
  return result;
}

function encodeBody(body, headers) {
  if (body == null) return null;
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === 'string') return Buffer.from(body);
  if (typeof body === 'object') {
    if (!Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) {
      headers['content-type'] = 'application/json';
    }
    return Buffer.from(JSON.stringify(body));
  }
  throw new HttpCubeError('INVALID_BODY', 'Body must be a string, Buffer, Uint8Array, object, or null');
}

function getHeader(headers, name) {
  const wanted = name.toLowerCase();
  const key = Object.keys(headers).find(candidate => candidate.toLowerCase() === wanted);
  return key == null ? undefined : headers[key];
}

function deleteHeader(headers, name) {
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) delete headers[key];
  }
}

function requestOnce(url, options) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const requestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: options.method,
      headers: options.headers,
      signal: options.signal,
      timeout: options.timeoutMs
    };

    const req = transport(requestOptions, (res) => {
      const chunks = [];
      let size = 0;
      const max = options.maxResponseBytes;

      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > max) {
          req.destroy(new HttpCubeError('RESPONSE_TOO_LARGE', `Response exceeded ${max} bytes`));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        const body = Buffer.concat(chunks, size);
        resolve({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          headers: res.headers,
          url: url.toString(),
          body,
          durationMs: Date.now() - startedAt,
          redirected: false
        });
      });
    });

    req.on('timeout', () => req.destroy(new HttpCubeError('TIMEOUT', `Request timed out after ${options.timeoutMs}ms`, { retryable: true })));
    req.on('error', (error) => {
      if (error instanceof HttpCubeError) return reject(error);
      if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
        return reject(new HttpCubeError('ABORTED', 'Request was aborted', { cause: error }));
      }
      reject(new HttpCubeError('NETWORK_ERROR', error.message || 'HTTP request failed', { retryable: true, cause: error }));
    });

    if (options.body) req.write(options.body);
    req.end();
  });
}

function redirectLocation(response) {
  const value = response.headers.location;
  if (Array.isArray(value)) return value[0];
  return value;
}

function nextRedirectMethod(status, method) {
  if (status === 303) return method === 'HEAD' ? 'HEAD' : 'GET';
  if ((status === 301 || status === 302) && method === 'POST') return 'GET';
  return method;
}

export async function request(urlValue, options = {}) {
  let url = validateUrl(urlValue);
  let method = String(options.method || (options.body == null ? 'GET' : 'POST')).toUpperCase();
  if (!METHODS.has(method)) throw new HttpCubeError('INVALID_METHOD', `Unsupported HTTP method: ${method}`);

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new HttpCubeError('INVALID_TIMEOUT', 'timeoutMs must be a positive number');

  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new HttpCubeError('INVALID_RESPONSE_LIMIT', 'maxResponseBytes must be a positive safe integer');
  }

  const maxRedirects = options.maxRedirects ?? 0;
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0) throw new HttpCubeError('INVALID_REDIRECT_LIMIT', 'maxRedirects must be a non-negative integer');

  const headers = normalizeHeaders(options.headers);
  let body = encodeBody(options.body, headers);
  if (body && getHeader(headers, 'content-length') == null) headers['content-length'] = String(body.length);

  let redirectCount = 0;
  while (true) {
    const response = await requestOnce(url, {
      method,
      headers,
      body,
      signal: options.signal,
      timeoutMs,
      maxResponseBytes
    });

    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    const location = isRedirect ? redirectLocation(response) : undefined;
    if (!isRedirect || !location || redirectCount >= maxRedirects) {
      return {
        ...response,
        redirected: redirectCount > 0
      };
    }

    const nextUrl = validateUrl(new URL(location, url).toString());
    if (nextUrl.protocol !== url.protocol && !options.allowProtocolChange) {
      throw new HttpCubeError('REDIRECT_PROTOCOL_CHANGE', 'Redirect changed protocol and allowProtocolChange is false');
    }

    const nextMethod = nextRedirectMethod(response.status, method);
    if (nextMethod !== method) {
      method = nextMethod;
      body = null;
      deleteHeader(headers, 'content-length');
    }

    url = nextUrl;
    redirectCount += 1;
  }
}

export async function get(url, options = {}) { return request(url, { ...options, method: 'GET' }); }
export async function post(url, body, options = {}) { return request(url, { ...options, method: 'POST', body }); }
export async function put(url, body, options = {}) { return request(url, { ...options, method: 'PUT', body }); }
export async function patch(url, body, options = {}) { return request(url, { ...options, method: 'PATCH', body }); }
export async function del(url, options = {}) { return request(url, { ...options, method: 'DELETE' }); }

export function text(response, encoding = 'utf8') {
  if (!response || !Buffer.isBuffer(response.body)) throw new HttpCubeError('INVALID_RESPONSE', 'Expected a response from request()');
  return response.body.toString(encoding);
}

export function json(response) {
  try { return JSON.parse(text(response)); }
  catch (error) { throw new HttpCubeError('INVALID_JSON', 'Response body is not valid JSON', { cause: error }); }
}
