// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

/**
 * Browser Network Interception Cube v0.1
 *
 * Deterministic network interception *control* at the CDP layer. Zero third-party deps.
 * Built on capability injection: works against any object exposing
 * `on(method, handler)` + `send(method, params)` — exactly what the frozen
 * browser cube's CdpConnection provides, and trivially faked for unit tests.
 *
 * v0.1 contract (truthful):
 *  - Real-browser interception uses the CDP **Fetch** domain:
 *      Fetch.enable -> Fetch.requestPaused -> (fulfill | continue | fail)
 *    This is the mechanism that actually intercepts and can mock/block requests.
 *  - This cube wires that flow correctly: it will PAUSE, BLOCK (fail), or PASS-THROUGH
 *    real requests, and it builds a deterministic traffic log (method, url, status,
 *    mimeType, headers, timestamp, bodyLength).
 *  - RESPONSE-BODY CAPTURE is NOT performed by v0.1. The `body` field is left `null`
 *    unless the caller supplies a mock body via a `respond` route. Real response-body
 *    capture would require Fetch.getResponseBody + decoding and is future architecture.
 *  - Custom-body mocking (`respond` route) is fully supported via Fetch.fulfillRequest
 *    at the capability boundary; the body is whatever the route provides.
 */

export class NetworkError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'NetworkError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    Object.freeze(this);
  }
}

function fail(code, message, options) {
  throw new NetworkError(code, message, options);
}

const DEFAULT_BODY_CAP_BYTES = 64 * 1024;

/** Encode a UTF-8 string as base64 (CDP Fetch.fulfillRequest body must be base64). */
function toBase64(value) {
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'utf8').toString('base64');
  // Browser fallback (defensive; cube targets Node.js runtime).
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

export class NetworkInterceptor {
  constructor(cdp, options = {}) {
    if (!cdp || typeof cdp.on !== 'function' || typeof cdp.send !== 'function') {
      fail('INVALID_CDP', 'NetworkInterceptor requires a CDP connection with on() and send()');
    }
    this.cdp = cdp;
    this.bodyCapBytes = options.bodyCapBytes ?? DEFAULT_BODY_CAP_BYTES;
    this.routes = [];
    this.log = [];
    this._unsub = [];
    this._enabled = false;
    this._requestBuffer = new Map();
  }

  async enable() {
    if (this._enabled) return;
    // Fetch domain is the correct CDP mechanism for request interception/mocking.
    await this.cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    this._unsub.push(this.cdp.on('Fetch.requestPaused', e => this.#onRequestPaused(e)));
    this._unsub.push(this.cdp.on('Fetch.authRequired', () => {})); // ignore auth challenges
    this._enabled = true;
  }

  #onRequestPaused(e) {
    const requestId = e.requestId;
    const interceptionId = e.requestId; // Fetch uses requestId as the interception handle
    const url = e.request?.url;
    const method = e.request?.method ?? 'GET';

    const req = {
      requestId,
      url,
      method,
      headers: { ...(e.request?.headers ?? {}) },
      timestamp: e.timestamp ?? 0,
      body: null,
      bodyLength: 0,
    };
    this._requestBuffer.set(requestId, req);

    if (this._matchesBlock(url)) {
      // Block: fail the request at the network layer.
      this.cdp.send('Fetch.failRequest', { requestId: interceptionId, errorReason: 'Failed' }).catch(() => {});
      // Record blocked requests in the traffic log (body null; bodyLength 0).
      this.log.push(Object.freeze({ ...req }));
      this._requestBuffer.delete(requestId);
      return;
    }

    const match = this._matchMock(url, method);
    if (match) {
      const body = match.body != null ? String(match.body) : '';
      const bodyLength = Buffer.byteLength(body, 'utf8');
      if (bodyLength > this.bodyCapBytes) {
        fail('BODY_CAP_EXCEEDED', `mock body exceeds bodyCapBytes (${this.bodyCapBytes})`);
      }
      this.cdp.send('Fetch.fulfillRequest', {
        requestId: interceptionId,
        responseCode: match.status ?? 200,
        responseHeaders: match.responseHeaders ?? [{ name: 'Content-Type', value: 'application/json' }],
        body: toBase64(body),
      }).catch(() => {});
      // A fulfilled request produces no further Fetch events; record it now.
      req.bodyLength = bodyLength;
      this.log.push(Object.freeze({ ...req }));
      this._requestBuffer.delete(requestId);
      return;
    }

    // No route matched: continue the request unchanged (pass-through).
    this.cdp.send('Fetch.continueRequest', { requestId: interceptionId }).catch(() => {});
    // Record pass-through requests in the traffic log (body null; bodyLength 0).
    this.log.push(Object.freeze({ ...req }));
    this._requestBuffer.delete(requestId);
  }

  /** Register a route: { pattern, action: 'block'|'respond', ... } */
  addRoute(route) {
    if (!route || typeof route.pattern !== 'string') fail('INVALID_ROUTE', 'route must have a pattern string');
    if (!['block', 'respond'].includes(route.action)) fail('INVALID_ROUTE_ACTION', 'route action must be "block" or "respond"');
    this.routes.push(Object.freeze({ ...route }));
    return this.routes.length;
  }

  _matchesBlock(url) {
    return this.routes.some(r => r.action === 'block' && this._urlMatches(r.pattern, url));
  }

  _matchMock(url, method) {
    const r = this.routes.find(r => r.action === 'respond' && this._urlMatches(r.pattern, url) && (r.method ? r.method === method : true));
    return r;
  }

  _urlMatches(pattern, url) {
    if (!url) return false;
    if (pattern === '**' || pattern === '*') return true;
    if (pattern.includes('*')) {
      const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      return re.test(url);
    }
    return url.startsWith(pattern) || url === pattern;
  }

  /**
   * Record a response-side observation. Optional: only used when the caller has
   * the Network domain enabled and forwards response events. v0.1 never requires it.
   */
  observeResponse(requestId, status, mimeType, headers) {
    const req = this._requestBuffer.get(requestId);
    if (!req) return;
    req.status = status;
    req.mimeType = mimeType;
    req.responseHeaders = { ...(headers ?? {}) };
  }

  /** Stable, serializable traffic log (frozen). body is null unless a mock body was supplied. */
  snapshot() {
    return Object.freeze(this.log.map(e => ({
      url: e.url, method: e.method, status: e.status ?? null, mimeType: e.mimeType ?? null,
      headers: { ...(e.headers || {}) }, timestamp: e.timestamp, bodyLength: e.bodyLength ?? 0,
      body: e.body ?? null,
    })));
  }

  async destroy() {
    if (this._enabled) {
      try { await this.cdp.send('Fetch.disable'); } catch { /* already closed */ }
    }
    for (const unsub of this._unsub) { try { unsub(); } catch { /* noop */ } }
    this._unsub = [];
    this._enabled = false;
    this._requestBuffer.clear();
  }
}

export { DEFAULT_BODY_CAP_BYTES };
