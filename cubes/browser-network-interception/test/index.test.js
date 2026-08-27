// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { NetworkInterceptor, NetworkError, DEFAULT_BODY_CAP_BYTES } from '../src/index.js';

/** Fake CDP: emits synthetic network events on demand. */
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
}

test('enable registers CDP network domains', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  assert.ok(cdp.sent.some(s => s.method === 'Network.enable'));
  assert.equal(ni._enabled, true);
});

test('rejects a CDP without on/send', () => {
  assert.throws(() => new NetworkInterceptor({}),
    err => err instanceof NetworkError && err.code === 'INVALID_CDP');
});

test('logs requests and responses deterministically', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  cdp.emit('Network.requestWillBeSent', { requestId: 'r1', request: { url: 'https://example.com/api', method: 'GET', headers: {} } });
  cdp.emit('Network.responseReceived', { requestId: 'r1', response: { status: 200, mimeType: 'application/json', headers: {} } });
  cdp.emit('Network.loadingFinished', { requestId: 'r1' });
  const snap = ni.snapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].url, 'https://example.com/api');
  assert.equal(snap[0].status, 200);
  assert.equal(snap[0].method, 'GET');
});

test('blocks URLs matching a block route', async () => {
  const cdp = new FakeCDP();
  let continued = null;
  cdp.send = (method, params) => { if (method === 'Network.continueInterceptedRequest') continued = params; return Promise.resolve({}); };
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  ni.addRoute({ pattern: 'https://example.com/blocked', action: 'block' });
  cdp.emit('Network.requestWillBeSent', { requestId: 'r2', request: { url: 'https://example.com/blocked', method: 'GET' } });
  assert.ok(continued, 'block should trigger continueInterceptedRequest');
  assert.equal(continued.errorReason, 'Failed');
});

test('responds with mock body for respond routes', async () => {
  const cdp = new FakeCDP();
  let continued = null;
  cdp.send = (method, params) => { if (method === 'Network.continueInterceptedRequest') continued = params; return Promise.resolve({}); };
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  ni.addRoute({ pattern: 'https://example.com/mock', action: 'respond', status: 200, body: { ok: true } });
  cdp.emit('Network.requestWillBeSent', { requestId: 'r3', request: { url: 'https://example.com/mock', method: 'GET' } });
  assert.ok(continued);
  assert.equal(continued.responseCode, 200);
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

test('destroy disables network and unsubscribes', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  await ni.destroy();
  assert.equal(ni._enabled, false);
  assert.ok(cdp.sent.some(s => s.method === 'Network.disable'));
});

test('snapshot is frozen/immutable', async () => {
  const cdp = new FakeCDP();
  const ni = new NetworkInterceptor(cdp);
  await ni.enable();
  cdp.emit('Network.requestWillBeSent', { requestId: 'r1', request: { url: 'https://example.com', method: 'GET' } });
  cdp.emit('Network.loadingFinished', { requestId: 'r1' });
  const snap = ni.snapshot();
  assert.throws(() => { snap.push({}); }, TypeError);
});

test('errors carry stable code', () => {
  const e = new NetworkError('X', 'msg');
  assert.equal(e.code, 'X');
});
