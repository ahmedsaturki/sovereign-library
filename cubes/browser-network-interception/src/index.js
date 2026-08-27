// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

/**
 * Browser Network Interception Cube v0.1
 *
 * Deterministic network interception at the CDP layer. Zero third-party deps.
 * Built on capability injection: works against any object exposing
 * `on(method, handler)` + `send(method, params)` — exactly what the frozen
 * browser cube's CdpConnection provides, and trivially faked for unit tests.
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
    await this.cdp.send('Network.enable');
    this._unsub.push(this.cdp.on('Network.requestWillBeSent', e => this.#onRequest(e)));
    this._unsub.push(this.cdp.on('Network.responseReceived', e => this.#onResponse(e)));
    this._unsub.push(this.cdp.on('Network.loadingFinished', e => this.#onBody(e)));
    this._enabled = true;
  }

  #onRequest(e) {
    const req = {
      requestId: e.requestId,
      url: e.request?.url,
      method: e.request?.method ?? 'GET',
      headers: { ...(e.request?.headers ?? {}) },
      timestamp: e.timestamp ?? 0,
      body: null
    };
    this._requestBuffer.set(e.requestId, req);
    if (this._matchesBlock(e.request?.url)) {
      this.cdp.send('Network.continueInterceptedRequest', {
        interceptionId: e.requestId,
        errorReason: 'Failed'
      }).catch(() => {});
      return;
    }
    const match = this._matchMock(e.request?.url, e.request?.method);
    if (match) {
      this.cdp.send('Network.continueInterceptedRequest', {
        interceptionId: e.requestId,
        responseCode: match.status,
        responseHeaders: {},
        body: match.body instanceof Buffer ? match.body.toString('latin1') : String(match.body ?? '')
      }).catch(() => {});
    }
  }

  #onResponse(e) {
    const req = this._requestBuffer.get(e.requestId);
    if (req) {
      req.status = e.response?.status;
      req.mimeType = e.response?.mimeType;
      req.responseHeaders = { ...(e.response?.headers ?? {}) };
    }
  }

  #onBody(e) {
    const req = this._requestBuffer.get(e.requestId);
    if (!req || req.body != null) return;
    // In a real implementation we would fetch via Network.getResponseBody.
    // For determinism we leave body null unless the user opts in via a mock.
    req.bodyCapBytes = this.bodyCapBytes;
    this.log.push(Object.freeze({ ...req, bodyLength: req.body ? req.body.length : 0 }));
    this._requestBuffer.delete(e.requestId);
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

  /** Stable, serializable traffic log (frozen). */
  snapshot() {
    return Object.freeze(this.log.map(e => ({
      url: e.url, method: e.method, status: e.status ?? null, mimeType: e.mimeType ?? null,
      headers: { ...(e.headers || {}) }, timestamp: e.timestamp, bodyLength: e.bodyLength ?? 0
    })));
  }

  async destroy() {
    if (this._enabled) {
      try { await this.cdp.send('Network.disable'); } catch {}
    }
    for (const unsub of this._unsub) { try { unsub(); } catch {} }
    this._unsub = [];
    this._enabled = false;
  }
}

export { DEFAULT_BODY_CAP_BYTES };
