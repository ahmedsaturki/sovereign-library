// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { NetworkInterceptor, NetworkError, DEFAULT_BODY_CAP_BYTES } from '../src/index.js';

/** Fake CDP: emits synthetic Fetch-domain events on demand. */
class FakeCDP {
  constructor() { this.handlers = new Map(); this.sent = []; }
  on(method, handler) {
    const arr = this.handlers.get(method) || [];
    arr.push(handler);
    this.handlers.set(method, arr);
    return () => { this.handlers.set(method, arr.filter(h => h !== handler)); };
  }
  async send(method, params = {}) { this.sent.push({ method, params }); }
  emit(method, params) {
    for (const h of this.handlers.get(method) || []) h(params);
  }
  sentOf(method) { return this.sent.filter(s => s.method === method); }
}

test('enable registers the Fetch domain (correct CDP interception mechanism)', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  assert.ok(cdp.sentOf('Fetch.enable').length === 1, 'must enable Fetch domain');
  assert.equal(ni._enabled, true);
});

test('rejects a CDP without on/send', () => {
  assert.throws(() => new NetworkInterceptor({}),
    err => err instanceof NetworkError && err.code === 'INVALID_CDP');
});

test('passes through requests that match no route', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  cdp.emit('Fetch.requestPaused', { requestId: 'r1', request: { url: 'https://example.com/api', method: 'GET', headers: {} } });
  const cont = cdp.sentOf('Fetch.continueRequest');
  assert.equal(cont.length, 1, 'unmatched request must continue');
  assert.equal(cont[0].params.requestId, 'r1');
  assert.equal(cdp.sentOf('Fetch.fulfillRequest').length, 0);
  assert.equal(cdp.sentOf('Fetch.failRequest').length, 0);
});

test('blocks URLs matching a block route (Fetch.failRequest)', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  ni.addRoute({ pattern: 'https://example.com/blocked', action: 'block' });
  cdp.emit('Fetch.requestPaused', { requestId: 'r2', request: { url: 'https://example.com/blocked', method: 'GET' } });
  const failed = cdp.sentOf('Fetch.failRequest');
  assert.equal(failed.length, 1, 'block must fail the request');
  assert.equal(failed[0].params.requestId, 'r2');
  assert.equal(failed[0].params.errorReason, 'Failed');
});

test('responds with mock body for respond routes (Fetch.fulfillRequest, base64 body)', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  ni.addRoute({ pattern: 'https://example.com/mock', action: 'respond', status: 200, body: '{"ok":true}' });
  cdp.emit('Fetch.requestPaused', { requestId: 'r3', request: { url: 'https://example.com/mock', method: 'GET' } });
  const fulfilled = cdp.sentOf('Fetch.fulfillRequest');
  assert.equal(fulfilled.length, 1, 'respond route must fulfill');
  assert.equal(fulfilled[0].params.requestId, 'r3');
  assert.equal(fulfilled[0].params.responseCode, 200);
  // body must be base64 of the mock body
  const expected = Buffer.from('{"ok":true}', 'utf8').toString('base64');
  assert.equal(fulfilled[0].params.body, expected);
  // mocked request is recorded in the traffic log
  const snap = ni.snapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].url, 'https://example.com/mock');
  assert.equal(snap[0].bodyLength, Buffer.byteLength('{"ok":true}', 'utf8'));
});

test('respond route without explicit body still fulfills (empty body)', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  ni.addRoute({ pattern: 'https://example.com/empty', action: 'respond', status: 204 });
  cdp.emit('Fetch.requestPaused', { requestId: 'r4', request: { url: 'https://example.com/empty', method: 'GET' } });
  const fulfilled = cdp.sentOf('Fetch.fulfillRequest');
  assert.equal(fulfilled.length, 1);
  assert.equal(fulfilled[0].params.responseCode, 204);
});

test('addRoute validates inputs', () => {
  const ni = new NetworkInterceptor(new FakeCDP());
  assert.throws(() => ni.addRoute(null), err => err.code === 'INVALID_ROUTE');
  assert.throws(() => ni.addRoute({ pattern: 'x', action: 'weird' }), err => err.code === 'INVALID_ROUTE_ACTION');
});

test('wildcard pattern matches any URL', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  ni.addRoute({ pattern: '**', action: 'block' });
  assert.equal(ni._matchesBlock('https://anywhere.com'), true);
});

test('does not use the (incorrect) Network domain for interception', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  assert.equal(cdp.sentOf('Network.enable').length, 0, 'Network domain is not the interception mechanism');
  assert.equal(cdp.sentOf('Network.continueInterceptedRequest').length, 0, 'continueInterceptedRequest is not valid here');
});

test('destroy disables Fetch and unsubscribes', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  await ni.destroy();
  assert.equal(ni._enabled, false);
  assert.ok(cdp.sentOf('Fetch.disable').length === 1);
  // double destroy is safe
  await ni.destroy();
  assert.equal(cdp.sentOf('Fetch.disable').length, 1, 'disable sent only once');
});

test('enable twice is idempotent', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  await ni.enable();
  assert.equal(cdp.sentOf('Fetch.enable').length, 1);
});

test('snapshot is frozen/immutable', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  cdp.emit('Fetch.requestPaused', { requestId: 'r1', request: { url: 'https://example.com', method: 'GET' } });
  const snap = ni.snapshot();
  assert.throws(() => { snap.push({}); }, TypeError);
});

test('errors carry stable code', () => {
  const e = new NetworkError('X', 'msg');
  assert.equal(e.code, 'X');
});

test('body field is null unless a mock body was supplied (no real-body capture in v0.1)', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  // pass-through request: body must remain null in the log
  cdp.emit('Fetch.requestPaused', { requestId: 'p1', request: { url: 'https://example.com/page', method: 'GET' } });
  // mocked request: body echoed as null in the snapshot (only bodyLength is tracked)
  ni.addRoute({ pattern: 'https://example.com/mock', action: 'respond', status: 200, body: 'x' });
  cdp.emit('Fetch.requestPaused', { requestId: 'm1', request: { url: 'https://example.com/mock', method: 'GET' } });
  const snap = ni.snapshot();
  const passthrough = snap.find(s => s.url === 'https://example.com/page');
  assert.equal(passthrough.body, null);
  assert.equal(passthrough.bodyLength, 0);
  const mocked = snap.find(s => s.url === 'https://example.com/mock');
  assert.equal(mocked.body, null);
  assert.equal(mocked.bodyLength, 1);
});
