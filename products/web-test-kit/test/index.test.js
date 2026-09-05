// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { WebTestKit, By, expect, Snapshot } from '../src/index.js';

/** Minimal fake BrowserSession: only needs `evaluate`. */
class FakeSession {
  constructor(state = {}) {
    this.state = state;
    this.title = state.title || 'Demo';
    this.url = state.url || 'https://example.com/';
    this.content = state.content || '<html><body><button data-testid="go">Go</button></body></html>';
  }
  async evaluate(expr) {
    if (expr.includes('document.title')) return this.title;
    if (expr.includes('location.href')) return this.url;
    if (expr.includes('outerHTML')) return this.content;
    // Delegate to the interaction/assertion internal IIFEs via a tiny evaluator.
    return fakeEvaluate(expr, this);
  }
}

function fakeEvaluate(expr, session) {
  const m = /const __strategy = (\{[\s\S]*?\});/.exec(expr);
  const strategy = m ? JSON.parse(m[1]) : { kind: 'css', value: '*' };
  const matched = () => {
    if (strategy.kind === 'testId') return session.content.includes(`data-testid="${strategy.value}"`);
    if (strategy.kind === 'css') return session.content.includes(strategy.value.replace(/[#.]/g, ''));
    return session.content.includes(strategy.value || 'button');
  };
  // count probe
  if (/return \{ count: nodes\.length \};/.test(expr)) {
    return { count: matched() ? 1 : 0 };
  }
  // inspect probe (returns {found, visible, ...})
  if (/return \{ found:/.test(expr)) {
    return {
      found: matched(),
      visible: matched(),
      disabled: false,
      value: null,
      textContent: 'Go',
      label: 'Go',
      tagName: 'BUTTON',
      type: null
    };
  }
  // attribute probe
  if (expr.includes('getAttribute(') && !expr.includes('dispatchEvent')) {
    return strategy.value ? 'x' : null;
  }
  // action probe
  if (expr.includes('dispatchEvent')) return true;
  // inspect probe
  return {
    found: matched(),
    visible: matched(),
    disabled: false,
    value: null,
    textContent: 'Go',
    label: 'Go',
    tagName: 'BUTTON',
    type: null
  };
}

test('WebTestKit composes cubes without a real browser', async () => {
  const session = new FakeSession();
  const kit = new WebTestKit(session);
  assert.equal(await kit.title(), 'Demo');
  assert.equal(await kit.url(), 'https://example.com/');
  const loc = kit.locator(By.testId('go'));
  await expect(loc).toBeVisible();
  await expect(loc).toHaveText('Go');
});

test('WebTestKit snapshot diff works end to end', () => {
  const session = new FakeSession();
  const kit = new WebTestKit(session);
  const a = kit.snapshotOf('<div>Hello</div>');
  const b = kit.snapshotOf('<div>Hello</div>');
  const c = kit.snapshotOf('<span>Hello</span>');
  assert.equal(kit.diffSnapshots(a, b).equal, true);
  assert.equal(kit.diffSnapshots(a, c).equal, false);
});

test('WebTestKit exposes a recorder facade', () => {
  const session = new FakeSession();
  const kit = new WebTestKit(session);
  const rec = kit.recorder();
  assert.ok(rec && typeof rec.click === 'function', 'recorder should expose click()');
});

test('Snapshot is exported and usable directly', () => {
  const s = new Snapshot();
  assert.equal(s.diff(s.capture('<p>x</p>'), s.capture('<p>x</p>')).equal, true);
});
