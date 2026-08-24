import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { request, get, post, json, text, HttpCubeError } from '../src/index.js';

async function withServer(handler, fn) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('GET returns status, headers, body and timing', async () => {
  await withServer((req, res) => {
    res.writeHead(200, { 'x-cube': 'ok', 'content-type': 'text/plain' });
    res.end('hello');
  }, async (base) => {
    const response = await get(`${base}/`);
    assert.equal(response.status, 200);
    assert.equal(response.headers['x-cube'], 'ok');
    assert.equal(text(response), 'hello');
    assert.equal(typeof response.durationMs, 'number');
  });
});

test('POST encodes JSON and parses JSON response', async () => {
  await withServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      assert.equal(req.headers['content-type'], 'application/json');
      assert.equal(JSON.parse(body).name, 'Sovereign');
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  }, async (base) => {
    const response = await post(`${base}/`, { name: 'Sovereign' });
    assert.equal(response.status, 201);
    assert.deepEqual(json(response), { ok: true });
  });
});

test('redirects are opt-in and bounded', async () => {
  await withServer((req, res) => {
    if (req.url === '/start') {
      res.writeHead(302, { location: '/done' });
      res.end();
      return;
    }
    res.end('done');
  }, async (base) => {
    const direct = await request(`${base}/start`);
    assert.equal(direct.status, 302);
    const followed = await request(`${base}/start`, { maxRedirects: 1 });
    assert.equal(followed.status, 200);
    assert.equal(text(followed), 'done');
    assert.equal(followed.redirected, true);
  });
});

test('303 changes POST to GET and clears a case-insensitive content-length header', async () => {
  await withServer((req, res) => {
    if (req.url === '/start') {
      res.writeHead(303, { location: '/done' });
      res.end();
      return;
    }
    assert.equal(req.method, 'GET');
    assert.equal(req.headers['content-length'], undefined);
    res.end('done');
  }, async (base) => {
    const response = await request(`${base}/start`, {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Length': '2' },
      maxRedirects: 1
    });
    assert.equal(response.status, 200);
    assert.equal(text(response), 'done');
  });
});

test('response size limit is enforced', async () => {
  await withServer((req, res) => res.end('0123456789'), async (base) => {
    await assert.rejects(
      () => get(base, { maxResponseBytes: 5 }),
      error => error instanceof HttpCubeError && error.code === 'RESPONSE_TOO_LARGE'
    );
  });
});

test('invalid URL and method are deterministic errors', async () => {
  await assert.rejects(() => request('ftp://example.com'), error => error.code === 'UNSUPPORTED_PROTOCOL');
  await assert.rejects(() => request('http://127.0.0.1:1', { method: 'TRACE' }), error => error.code === 'INVALID_METHOD');
});

test('AbortSignal cancellation is surfaced', async () => {
  await withServer((req) => setTimeout(() => req.destroy(), 1000), async (base) => {
    const controller = new AbortController();
    const promise = get(base, { signal: controller.signal, timeoutMs: 5000 });
    controller.abort();
    await assert.rejects(promise, error => error instanceof HttpCubeError && error.code === 'ABORTED');
  });
});

test('timeout is surfaced as a deterministic retryable error', async () => {
  await withServer((req, res) => setTimeout(() => res.end('late'), 250), async (base) => {
    await assert.rejects(
      () => get(base, { timeoutMs: 25 }),
      error => error instanceof HttpCubeError && error.code === 'TIMEOUT' && error.retryable === true
    );
  });
});
