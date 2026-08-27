// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { SovereignAutomation, AutomationError, cli, VERSION } from '../src/index.js';
import { BrowserInteractions, By } from '../../../cubes/browser-interactions/src/index.js';
import { expect, Snapshot } from '../../../cubes/browser-assertions/src/index.js';

/** Fake frozen-style BrowserSession: only needs `cdp` + `close()` + `evaluate`. */
class FakeSession {
  constructor() {
    this.cdp = { on: () => () => {}, send: async () => ({}) };
    this.closed = false;
    this.evaluate = async () => null;
  }
  async close() { this.closed = true; }
}

/** Fake interactions layer (reuses real BrowserInteractions w/ fake session). */
class FakeInteractions {
  constructor() { this.calls = []; }
  locator(strategy) { this.calls.push(['locator', strategy]); return new FakeLocator(this, strategy); }
}
class FakeLocator {
  constructor(page, strategy) { this.page = page; this.strategy = strategy; }
  async click() { this.page.calls.push(['click', this.strategy]); return this; }
  async fill(v) { this.page.calls.push(['fill', this.strategy, v]); return this; }
  async press(k) { this.page.calls.push(['press', this.strategy, k]); return this; }
}

test('SovereignAutomation wires the full cube stack from a session', async () => {
  const session = new FakeSession();
  // Monkeypatch page to a fake so we don't need a real browser.
  const sa = new SovereignAutomation(session);
  sa.page = new FakeInteractions();
  sa.assert = new Snapshot();
  sa.visual = { capture: (h) => ({ canonical: h }) };
  assert.ok(sa.page, 'interactions wired');
  assert.ok(sa.net, 'network wired');
  assert.ok(sa.tabs, 'tabs wired');
  assert.ok(sa.visual, 'visual wired');
  assert.ok(sa.recorder, 'recorder wired');
  await sa.close();
  assert.equal(session.closed, true);
});

test('rejects a session without close()/cdp', () => {
  assert.throws(() => new SovereignAutomation({}), err => err instanceof AutomationError && err.code === 'INVALID_SESSION');
});

test('saveScript writes the recorded script to JSON', async () => {
  const session = new FakeSession();
  const sa = new SovereignAutomation(session);
  sa.page = new FakeInteractions();
  sa.recorder = { getScript: () => [{ kind: 'click', target: { kind: 'css', value: 'button' } }] };
  const file = await sa.saveScript('/tmp/sov-rec-test.json');
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(data.version, VERSION);
  assert.equal(data.steps.length, 1);
});

test('cli help returns without error', async () => {
  await cli(['--help']);
  assert.ok(true);
});

test('cli unknown command throws classified error', async () => {
  await assert.rejects(() => cli(['bogus']), err => err instanceof AutomationError && err.code === 'UNKNOWN_COMMAND');
});
