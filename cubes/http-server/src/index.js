import http from 'node:http';
import https from 'node:https';

export class HttpServerError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'HttpServerError';
    this.code = code;
    this.statusCode = options.statusCode ?? 500;
    Object.freeze(this);
  }
}

function assertMethod(method) {
  if (typeof method !== 'string' || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(method)) {
    throw new TypeError('method must be a valid HTTP token');
  }
  return method.toUpperCase();
}

function normalizePath(path) {
  if (typeof path !== 'string' || path.length === 0 || !path.startsWith('/')) {
    throw new TypeError('path must be an absolute pathname');
  }
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function compilePath(path) {
  const normalized = normalizePath(path);
  const names = [];
  const segments = normalized === '/' ? [] : normalized.slice(1).split('/');
  const pattern = ['^'];
  if (segments.length === 0) pattern.push('/?$');
  else {
    for (const segment of segments) {
      if (segment.startsWith(':')) {
        const name = segment.slice(1);
        if (!/^[A-Za-z0-9_]+$/.test(name)) throw new TypeError(`invalid path parameter: ${segment}`);
        names.push(name);
        pattern.push('/([^/]+)');
      } else if (segment === '*') {
        names.push('*');
        pattern.push('/(.*)');
      } else {
        pattern.push(`/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      }
    }
    pattern.push('/?$');
  }
  return { path: normalized, regex: new RegExp(pattern.join('')), names };
}

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, path, handler) {
    const normalizedMethod = assertMethod(method);
    if (typeof handler !== 'function') throw new TypeError('handler must be a function');
    const compiled = compilePath(path);
    this.routes.push({ method: normalizedMethod, ...compiled, handler });
    return this;
  }

  get(path, handler) { return this.add('GET', path, handler); }
  post(path, handler) { return this.add('POST', path, handler); }
  put(path, handler) { return this.add('PUT', path, handler); }
  patch(path, handler) { return this.add('PATCH', path, handler); }
  delete(path, handler) { return this.add('DELETE', path, handler); }
  head(path, handler) { return this.add('HEAD', path, handler); }
  options(path, handler) { return this.add('OPTIONS', path, handler); }

  match(method, pathname) {
    const normalizedMethod = assertMethod(method);
    const normalizedPath = normalizePath(pathname);
    const pathMatches = [];
    for (const route of this.routes) {
      const match = route.regex.exec(normalizedPath);
      if (!match) continue;
      const params = {};
      route.names.forEach((name, index) => { params[name] = decodeURIComponent(match[index + 1]); });
      pathMatches.push({ route, params });
    }
    const exact = pathMatches.find(item => item.route.method === normalizedMethod);
    if (exact) return { type: 'route', ...exact };
    if (normalizedMethod === 'HEAD') {
      const getRoute = pathMatches.find(item => item.route.method === 'GET');
      if (getRoute) return { type: 'route', ...getRoute, headOnly: true };
    }
    if (pathMatches.length) return { type: 'method-not-allowed', methods: [...new Set(pathMatches.map(item => item.route.method))].sort() };
    return { type: 'not-found' };
  }

  snapshot() {
    return Object.freeze(this.routes.map(route => Object.freeze({ path: route.path, method: route.method })));
  }
}

function createContext(req, res, match, bodyLimit) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const controller = new AbortController();
  const onClose = () => { if (!res.writableEnded) controller.abort(new HttpServerError('REQUEST_CLOSED', 'Request connection closed', { statusCode: 499 })); };
  req.once('aborted', onClose);
  res.once('close', onClose);

  let bodyPromise;
  const readBody = async () => {
    if (bodyPromise) return bodyPromise;
    bodyPromise = new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      const fail = error => { req.removeAllListeners('data'); reject(error); };
      req.on('data', chunk => {
        size += chunk.length;
        if (size > bodyLimit) fail(new HttpServerError('BODY_TOO_LARGE', `Request body exceeds ${bodyLimit} bytes`, { statusCode: 413 }));
        else chunks.push(chunk);
      });
      req.once('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.once('error', reject);
      req.once('aborted', () => reject(new HttpServerError('REQUEST_ABORTED', 'Request body was aborted', { statusCode: 499 })));
    });
    return bodyPromise;
  };

  const ctx = {
    req,
    res,
    method: req.method ?? 'GET',
    path: url.pathname,
    query: Object.freeze(Object.fromEntries(url.searchParams.entries())),
    params: Object.freeze(match?.params ?? {}),
    signal: controller.signal,
    state: Object.create(null),
    getHeader(name) { return req.headers[String(name).toLowerCase()] ?? undefined; },
    async text() { return readBody(); },
    async json() {
      const text = await readBody();
      try { return text ? JSON.parse(text) : null; }
      catch (cause) { throw new HttpServerError('INVALID_JSON', 'Request body is not valid JSON', { statusCode: 400, cause }); }
    },
    status(code) {
      if (!Number.isInteger(code) || code < 100 || code > 999) throw new RangeError('status code must be an integer between 100 and 999');
      res.statusCode = code;
      return ctx;
    },
    setHeader(name, value) { res.setHeader(name, value); return ctx; },
    type(value) { res.setHeader('content-type', value); return ctx; },
    async textResponse(value, code = res.statusCode) {
      if (res.writableEnded) return;
      res.statusCode = code;
      if (!res.hasHeader('content-type')) res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(String(value));
    },
    async jsonResponse(value, code = res.statusCode) {
      if (res.writableEnded) return;
      res.statusCode = code;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    },
    send(value, code = res.statusCode) {
      if (res.writableEnded) return;
      res.statusCode = code;
      if (Buffer.isBuffer(value) || typeof value === 'string') res.end(value);
      else { res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); }
    },
    end(value = '') { if (!res.writableEnded) res.end(value); },
    cleanup() {
      req.removeListener('aborted', onClose);
      res.removeListener('close', onClose);
    },
  };
  return ctx;
}

function compose(middleware, terminal) {
  return function execute(ctx) {
    let index = -1;
    const dispatch = async current => {
      if (current <= index) throw new Error('next() called multiple times');
      index = current;
      const fn = current === middleware.length ? terminal : middleware[current];
      if (!fn) return;
      return fn(ctx, () => dispatch(current + 1));
    };
    return dispatch(0);
  };
}

export class HttpApp {
  constructor(options = {}) {
    this.router = new Router();
    this.middleware = [];
    this.bodyLimit = options.bodyLimit ?? 1_048_576;
    if (!Number.isSafeInteger(this.bodyLimit) || this.bodyLimit < 1) throw new RangeError('bodyLimit must be a safe integer >= 1');
    this.errorHandler = async (error, ctx) => {
      if (ctx.res.writableEnded) return;
      const status = error?.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
      ctx.jsonResponse({ error: error?.code ?? 'INTERNAL_ERROR', message: status >= 500 ? 'Internal Server Error' : String(error?.message ?? 'Request failed') }, status);
    };
  }

  use(handler) { if (typeof handler !== 'function') throw new TypeError('middleware must be a function'); this.middleware.push(handler); return this; }
  onError(handler) { if (typeof handler !== 'function') throw new TypeError('error handler must be a function'); this.errorHandler = handler; return this; }
  route(method, path, handler) { this.router.add(method, path, handler); return this; }
  get(path, handler) { this.router.get(path, handler); return this; }
  post(path, handler) { this.router.post(path, handler); return this; }
  put(path, handler) { this.router.put(path, handler); return this; }
  patch(path, handler) { this.router.patch(path, handler); return this; }
  delete(path, handler) { this.router.delete(path, handler); return this; }

  handler() {
    const terminal = async ctx => {
      const matched = this.router.match(ctx.method, ctx.path);
      if (matched.type === 'not-found') return ctx.jsonResponse({ error: 'NOT_FOUND', message: 'Route not found' }, 404);
      if (matched.type === 'method-not-allowed') {
        ctx.res.setHeader('allow', matched.methods.join(', '));
        return ctx.jsonResponse({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }, 405);
      }
      ctx.params = Object.freeze(matched.params);
      await matched.route.handler(ctx);
    };
    const pipeline = compose(this.middleware, terminal);
    return async (req, res) => {
      const matched = { params: {}, route: null };
      const ctx = createContext(req, res, matched, this.bodyLimit);
      try { await pipeline(ctx); }
      catch (error) { await this.errorHandler(error, ctx); }
      finally { ctx.cleanup(); if (!res.writableEnded) res.end(); }
    };
  }

  listen(options = {}) {
    const {
      port = 0,
      host,
      tls,
      backlog,
    } = options;
    const requestHandler = this.handler();
    const server = tls ? https.createServer(tls, requestHandler) : http.createServer(requestHandler);
    const address = () => server.address();
    const listening = new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen({ port, host, backlog }, () => {
        server.removeListener('error', reject);
        resolve(address());
      });
    });
    return Object.freeze({
      server,
      router: this.router,
      address,
      listening,
      close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
    });
  }
}

export function createApp(options) { return new HttpApp(options); }
export function createServer(options) { return createApp(options); }
