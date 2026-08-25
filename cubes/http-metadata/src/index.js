export class HttpMetadataError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'HttpMetadataError';
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const QUALITY = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

function normalizeName(name) {
  if (typeof name !== 'string' || !TOKEN.test(name)) throw new HttpMetadataError('INVALID_HEADER_NAME', `Invalid header name: ${name}`);
  return name.toLowerCase();
}

function validateValue(value) {
  if (typeof value !== 'string') throw new TypeError('header value must be a string');
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0 || code === 10 || code === 13) throw new HttpMetadataError('INVALID_HEADER_VALUE', 'Header value contains forbidden characters');
  }
  return value.trim();
}

export class HeaderMap {
  constructor(init = {}) {
    this.map = new Map();
    if (init instanceof HeaderMap) for (const [name, values] of init.entries()) this.map.set(name, [...values]);
    else if (init && typeof init === 'object') for (const [name, value] of Object.entries(init)) this.set(name, value);
  }
  set(name, value) { this.map.set(normalizeName(name), [validateValue(value)]); return this; }
  append(name, value) { const key = normalizeName(name); const list = this.map.get(key) ?? []; list.push(validateValue(value)); this.map.set(key, list); return this; }
  get(name) { const list = this.map.get(normalizeName(name)); return list ? list.join(', ') : undefined; }
  getAll(name) { return [...(this.map.get(normalizeName(name)) ?? [])]; }
  has(name) { return this.map.has(normalizeName(name)); }
  delete(name) { return this.map.delete(normalizeName(name)); }
  entries() { return this.map.entries(); }
  snapshot() { return Object.freeze(Object.fromEntries([...this.map.entries()].map(([k, v]) => [k, Object.freeze([...v])]))); }
}

export function parseCookieHeader(value) {
  if (typeof value !== 'string') throw new TypeError('Cookie header must be a string');
  const result = {};
  for (const segment of value.split(';')) {
    const item = segment.trim();
    if (!item) continue;
    const index = item.indexOf('=');
    if (index <= 0) continue;
    const name = item.slice(0, index).trim();
    const val = item.slice(index + 1).trim();
    if (!TOKEN.test(name)) throw new HttpMetadataError('INVALID_COOKIE_NAME', `Invalid cookie name: ${name}`);
    if (result[name] === undefined) result[name] = val;
  }
  return Object.freeze(result);
}

export function buildSetCookie(cookie) {
  if (!cookie || typeof cookie !== 'object') throw new TypeError('cookie must be an object');
  const name = String(cookie.name ?? '');
  if (!TOKEN.test(name)) throw new HttpMetadataError('INVALID_COOKIE_NAME', 'Invalid cookie name');
  const value = String(cookie.value ?? '');
  if (/[;\r\n]/.test(value)) throw new HttpMetadataError('INVALID_COOKIE_VALUE', 'Invalid cookie value');
  const parts = [`${name}=${value}`];
  if (cookie.Expires instanceof Date) parts.push(`Expires=${cookie.Expires.toUTCString()}`);
  if (cookie.MaxAge !== undefined) {
    if (!Number.isInteger(cookie.MaxAge) || cookie.MaxAge < 0) throw new RangeError('MaxAge must be an integer >= 0');
    parts.push(`Max-Age=${cookie.MaxAge}`);
  }
  if (cookie.Domain !== undefined) parts.push(`Domain=${String(cookie.Domain)}`);
  if (cookie.Path !== undefined) parts.push(`Path=${String(cookie.Path)}`);
  if (cookie.Secure) parts.push('Secure');
  if (cookie.HttpOnly) parts.push('HttpOnly');
  if (cookie.SameSite !== undefined) {
    const sameSite = String(cookie.SameSite).toLowerCase();
    if (!['lax', 'strict', 'none'].includes(sameSite)) throw new RangeError('SameSite must be Lax, Strict, or None');
    parts.push(`SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`);
  }
  return parts.join('; ');
}

export function parseContentType(value) {
  if (typeof value !== 'string') throw new TypeError('Content-Type must be a string');
  const [mediaType, ...parts] = value.split(';');
  const type = mediaType.trim().toLowerCase();
  if (!/^[^\s/]+\/[^\s;]+$/.test(type)) throw new HttpMetadataError('INVALID_CONTENT_TYPE', 'Invalid Content-Type');
  const parameters = {};
  for (const item of parts) {
    const index = item.indexOf('=');
    if (index <= 0) continue;
    const key = item.slice(0, index).trim().toLowerCase();
    let val = item.slice(index + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    parameters[key] = val;
  }
  return Object.freeze({ type, parameters: Object.freeze(parameters) });
}

export function parseContentLength(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) throw new HttpMetadataError('INVALID_CONTENT_LENGTH', 'Invalid Content-Length');
  const number = Number(value.trim());
  if (!Number.isSafeInteger(number)) throw new HttpMetadataError('INVALID_CONTENT_LENGTH', 'Content-Length is out of range');
  return number;
}

function parseWeightedList(value) {
  return String(value ?? '*').split(',').map((raw, index) => {
    const [token, ...parameters] = raw.trim().split(';');
    let q = 1;
    for (const parameter of parameters) {
      const [key, val] = parameter.trim().split('=');
      if (key?.toLowerCase() === 'q') {
        if (!QUALITY.test(val ?? '')) throw new HttpMetadataError('INVALID_QUALITY', `Invalid q value: ${val}`);
        q = Number(val);
      }
    }
    return { token: token.trim().toLowerCase(), q, index };
  }).filter(item => item.token && item.q > 0).sort((a, b) => b.q - a.q || a.index - b.index);
}

function negotiate(header, supported, matches) {
  if (!Array.isArray(supported) || supported.length === 0) return null;
  const ranges = parseWeightedList(header);
  let winner = null;
  let score = -1;
  for (const candidate of supported) {
    const normalized = candidate.toLowerCase();
    const range = ranges.find(item => matches(item.token, normalized));
    if (!range) continue;
    const specificity = range.token === '*' ? 0 : range.token.endsWith('/*') ? 1 : 2;
    const candidateScore = range.q * 10 + specificity / 10;
    if (candidateScore > score) { score = candidateScore; winner = candidate; }
  }
  return winner;
}

export function negotiateAccept(header, supported) {
  return negotiate(header, supported, (range, candidate) => range === '*/*' || range === candidate || (range.endsWith('/*') && candidate.startsWith(`${range.slice(0, -1)}`)));
}

export function negotiateAcceptEncoding(header, supported) {
  return negotiate(header, supported, (range, candidate) => range === '*' || range === candidate);
}

export function negotiateAcceptLanguage(header, supported) {
  return negotiate(header, supported, (range, candidate) => range === '*' || range === candidate || candidate.startsWith(`${range}-`) || range.startsWith(`${candidate}-`));
}

export function createETag(value, options = {}) {
  const opaque = Buffer.from(String(value)).toString('base64url');
  return `${options.weak ? 'W/' : ''}\"${opaque}\"`;
}

function splitEntityTags(value) {
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function weakCompare(a, b) {
  return a.replace(/^W\//, '') === b.replace(/^W\//, '');
}

export function matchesETag(header, etag, options = {}) {
  if (!header) return false;
  if (header.trim() === '*') return true;
  const tags = splitEntityTags(header);
  return tags.some(tag => options.weak ? weakCompare(tag, etag) : tag === etag);
}

export function ifNoneMatch(header, etag) {
  return matchesETag(header, etag, { weak: true });
}

export function ifMatch(header, etag) {
  return matchesETag(header, etag, { weak: false });
}
