// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { TabManager, TabManagerError } from '../src/index.js';

class FakeCDP {
  constructor() { this.handlers = new Map(); this.sent = []; this._id = 0; }
  on(method, handler) {
    const arr = this.handlers.get(method) || [];
    arr.push(handler);
    this.handlers.set(method, arr);
    return () => { this.handlers.set(method, arr.filter(h => h !== handler)); };
  }
  async send(method, params = {}) {
    this.sent.push({ method, params });
    if (method === 'Target.getTargets') return { targetInfos: [{ targetId: 't0', type: 'page', url: 'about:blank' }] };
    if (method === 'Target.createTarget') return { targetId: 't' + (++this._id) };
    if (method === 'Target.attachToTarget') return { sessionId: 's' + params.targetId };
    return {};
  }
  emit(method, params) {
    for (const h of this.handlers.get(method) || []) h(params);
  }
}

test('enable indexes existing targets', async () => {
  const cdp = new FakeCDP();
  const tm = new TabManager(cdp);
  await tm.enable();
  const list = tm.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 't0');
});

test('rejects invalid CDP', () => {
  assert.throws(() => new TabManager({}), err => err instanceof TabManagerError && err.code === 'INVALID_CDP');
});

test('open creates and activates a tab', async () => {
  const cdp = new FakeCDP();
  const tm = new TabManager(cdp);
  await tm.enable();
  const sess = await tm.open('https://example.com');
  assert.equal(sess.id, 't1');
  assert.equal(tm.activeId, 't1');
  assert.ok(cdp.sent.some(s => s.method === 'Target.createTarget'));
});

test('close removes a tab', async () => {
  const cdp = new FakeCDP();
  const tm = new TabManager(cdp);
  await tm.enable();
  const sess = await tm.open();
  await tm.close(sess.id);
  assert.ok(!tm.tabs.has(sess.id));
});

test('list returns frozen snapshots', async () => {
  const cdp = new FakeCDP();
  const tm = new TabManager(cdp);
  await tm.enable();
  const list = tm.list();
  assert.throws(() => list.push({}), TypeError);
});

test('destroy unsubscribes handlers', async () => {
  const cdp = new FakeCDP();
  const tm = new TabManager(cdp);
  await tm.enable();
  await tm.destroy();
  assert.equal(tm._enabled, false);
});
