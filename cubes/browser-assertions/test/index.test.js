// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { expect, Snapshot, AssertionsError, stableString, deepStableEqual } from '../src/index.js';

/** Fake locator that returns predetermined facts. */
class FakeLocator {
  constructor(facts) { this.facts = facts; }
  async isVisible() { return this.facts.visible; }
  async isEnabled() { return this.facts.enabled; }
  async textContent() { return this.facts.text; }
  async value() { return this.facts.value; }
  async getAttribute(name) { return this.facts.attrs?.[name]; }
  async count() { return this.facts.count ?? 1; }
}

test('toBeVisible passes when visible', async () => {
  await expect(new FakeLocator({ visible: true, enabled: true })).toBeVisible();
  assert.ok(true);
});

test('toBeVisible retries then fails with retryable error', async () => {
  let calls = 0;
  const loc = { isVisible: async () => { calls++; return false; } };
  await assert.rejects(
    () => expect(loc, { timeoutMs: 120 }).toBeVisible(),
    err => err instanceof AssertionsError && err.code === 'NOT_VISIBLE' && err.retryable === true
  );
  assert.ok(calls > 1, 'should have retried');
});

test('toBeEnabled / toBeDisabled', async () => {
  await expect(new FakeLocator({ visible: true, enabled: true })).toBeEnabled();
  await expect(new FakeLocator({ visible: true, enabled: false })).toBeDisabled();
});

test('toHaveText compares exact text', async () => {
  await expect(new FakeLocator({ text: 'Hello' })).toHaveText('Hello');
  await assert.rejects(
    () => expect(new FakeLocator({ text: 'Bye' }), { timeoutMs: 100 }).toHaveText('Hello'),
    err => err.code === 'TEXT_MISMATCH'
  );
});

test('toHaveValue and toHaveAttribute', async () => {
  await expect(new FakeLocator({ value: 'x@y.z', attrs: { 'data-id': '7' } })).toHaveValue('x@y.z');
  await expect(new FakeLocator({ attrs: { 'data-id': '7' } })).toHaveAttribute('data-id', '7');
});

test('toHaveCount', async () => {
  await expect(new FakeLocator({ count: 3 })).toHaveCount(3);
  await assert.rejects(
    () => expect(new FakeLocator({ count: 1 }), { timeoutMs: 100 }).toHaveCount(2),
    err => err.code === 'COUNT_MISMATCH'
  );
});

test('Snapshot captures and compares structurally', () => {
  const snap = new Snapshot();
  const a = snap.capture('<div>Hello</div>');
  const b = snap.capture('<div>Hello</div>');
  const c = snap.capture('<span>Hello</span>');
  assert.equal(snap.diff(a, b).equal, true, 'identical html compares equal');
  assert.equal(snap.diff(a, c).equal, false, 'different tag differs');
});

test('stableString ignores object key order', () => {
  assert.equal(stableString({ a: 1, b: 2 }), stableString({ b: 2, a: 1 }));
  assert.equal(deepStableEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }), true);
});

test('errors carry stable code + retryable flag', () => {
  const e = new AssertionsError('X', 'msg', { retryable: true });
  assert.equal(e.code, 'X');
  assert.equal(e.retryable, true);
});
