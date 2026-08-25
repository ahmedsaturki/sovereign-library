import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, HttpServerError, Router } from '../src/index.js';

async function open(app) {
  const handle = app.listen({ port: 0, host: '127.0.0.1' });
  const address = await handle.listening;
  return { handle, origin: `http://127.0.0.1:${address.port}` };
}

async function closeQuietly(handle) {
  try { await handle.close(); } catch (error) { if (error?.code !== 'ERR_SERVER_NOT_RUNNING') throw error; }
}

async function request(origin, path, options = {}) {
  const response = await fetch(`${origin}${path}`, options);
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  return { response, body, text };
}

test('router matches methods, params, and HEAD fallback deterministically', () => {
  const router = new Router();
  const handler = () => {};
  router.get('/users/:id', handler);
  const match = router.match('GET', '/users/42');
  assert.equal(match.type, 'route');
  assert.deepEqual(match.params, { id: '42' });
  assert.equal(router.match('HEAD', '/users/42').type, 'route');
  assert.equal(router.match('DELETE', '/users/42').type, 'method-not-allowed');
});

test('router exposes immutable route snapshots', () => {
  const router = new Router().get('/health', () => {});
  const snapshot = router.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot[0]), true);
  assert.deepEqual(snapshot[0], { path: '/health', method: 'GET' });
});

test('server serves params and query values', async () => {
  const app = createApp();
  app.get('/users/:id', ctx => ctx.jsonResponse({ id: ctx.params.id, q: ctx.query.q }));
  const { handle, origin } = await open(app);
  try {
    const { response, body } = await request(origin, '/users/42?q=test');
    assert.equal(response.status, 200);
    assert.deepEqual(body, { id: '42', q: 'test' });
  } finally { await closeQuietly(handle); }
});

test('404 and 405 are explicit and 405 includes Allow header', async () => {
  const app = createApp();
  app.get('/only-get', ctx => ctx.textResponse('ok'));
  const { handle, origin } = await open(app);
  try {
    const missing = await request(origin, '/missing');
    assert.equal(missing.response.status, 404);
    const wrong = await request(origin, '/only-get', { method: 'POST' });
    assert.equal(wrong.response.status, 405);
    assert.equal(wrong.response.headers.get('allow'), 'GET');
  } finally { await closeQuietly(handle); }
});

test('middleware order is deterministic and awaits async next', async () => {
  const app = createApp();
  const events = [];
  app.use(async (_ctx, next) => { events.push('a-before'); await next(); events.push('a-after'); });
  app.use(async (_ctx, next) => { events.push('b-before'); await next(); events.push('b-after'); });
  app.get('/order', ctx => { events.push('handler'); ctx.textResponse('ok'); });
  const { handle, origin } = await open(app);
  try {
    const { response } = await request(origin, '/order');
    assert.equal(response.status, 200);
    assert.deepEqual(events, ['a-before', 'b-before', 'handler', 'b-after', 'a-after']);
  } finally { await closeQuietly(handle); }
});

test('JSON body parsing works and malformed JSON becomes 400', async () => {
  const app = createApp();
  app.post('/json', async ctx => ctx.jsonResponse(await ctx.json()));
  const { handle, origin } = await open(app);
  try {
    const good = await request(origin, '/json', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) });
    assert.equal(good.response.status, 200);
    assert.deepEqual(good.body, { ok: true });
    const bad = await request(origin, '/json', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(bad.response.status, 400);
    assert.equal(bad.body.error, 'INVALID_JSON');
  } finally { await closeQuietly(handle); }
});

test('request body limit is enforced', async () => {
  const app = createApp({ bodyLimit: 4 });
  app.post('/body', async ctx => ctx.textResponse(await ctx.text()));
  const { handle, origin } = await open(app);
  try {
    const { response, body } = await request(origin, '/body', { method: 'POST', body: '12345' });
    assert.equal(response.status, 413);
    assert.equal(body.error, 'BODY_TOO_LARGE');
  } finally { await closeQuietly(handle); }
});

test('handler errors use centralized error handling and preserve safe status', async () => {
  const app = createApp();
  app.get('/known', () => { throw new HttpServerError('KNOWN', 'known failure', { statusCode: 418 }); });
  app.get('/unknown', () => { throw new Error('secret'); });
  const { handle, origin } = await open(app);
  try {
    const known = await request(origin, '/known');
    assert.equal(known.response.status, 418);
    assert.equal(known.body.error, 'KNOWN');
    const unknown = await request(origin, '/unknown');
    assert.equal(unknown.response.status, 500);
    assert.equal(unknown.body.error, 'INTERNAL_ERROR');
    assert.equal(unknown.body.message, 'Internal Server Error');
  } finally { await closeQuietly(handle); }
});

test('custom error handler can serialize domain failures', async () => {
  const app = createApp();
  app.onError(async (error, ctx) => ctx.jsonResponse({ code: error.code, handled: true }, error.statusCode ?? 500));
  app.get('/domain', () => { throw new HttpServerError('DOMAIN', 'domain', { statusCode: 409 }); });
  const { handle, origin } = await open(app);
  try {
    const { response, body } = await request(origin, '/domain');
    assert.equal(response.status, 409);
    assert.deepEqual(body, { code: 'DOMAIN', handled: true });
  } finally { await closeQuietly(handle); }
});

test('server close is idempotent for the owned lifecycle after first close', async () => {
  const app = createApp();
  app.get('/health', ctx => ctx.textResponse('ok'));
  const { handle, origin } = await open(app);
  const result = await request(origin, '/health');
  assert.equal(result.response.status, 200);
  await handle.close();
  await assert.rejects(handle.close(), error => error?.code === 'ERR_SERVER_NOT_RUNNING');
});
