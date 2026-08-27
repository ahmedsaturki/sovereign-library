// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserRecorder, RecorderError } from '../src/index.js';

/** Fake interactions layer that records calls instead of touching a browser. */
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

const bySubmit = { kind: 'role', value: 'button', name: 'Submit' };
const byEmail = { kind: 'css', value: '#email' };

test('records click/fill steps', async () => {
  const page = new FakeInteractions();
  const rec = new BrowserRecorder(page);
  await rec.click(bySubmit);
  await rec.fill(byEmail, 'user@example.com');
  const script = rec.getScript();
  assert.equal(script.length, 4, 'click=[locate,click] + fill=[locate,fill] = 4 steps');
  assert.equal(script[1].kind, 'click');
  assert.equal(script[3].kind, 'fill');
  assert.equal(script[3].params.value, 'user@example.com');
});

test('replay reproduces the exact sequence', async () => {
  const recordPage = new FakeInteractions();
  const rec = new BrowserRecorder(recordPage);
  await rec.click(bySubmit);
  await rec.fill(byEmail, 'a@b.c');

  const replayPage = new FakeInteractions();
  const n = await rec.replay(replayPage);
  assert.equal(n, 4);
  const actions = replayPage.calls.filter(c => c[0] !== 'locator');
  assert.deepEqual(actions, [
    ['click', bySubmit],
    ['fill', byEmail, 'a@b.c']
  ]);
});

test('replay rejects an invalid target', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.click(bySubmit);
  await assert.rejects(() => rec.replay(null), err => err instanceof RecorderError && err.code === 'INVALID_REPLAY_TARGET');
});

test('clear empties the script', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.click(bySubmit);
  rec.clear();
  assert.equal(rec.getScript().length, 0);
});

test('errors carry stable code', () => {
  const e = new RecorderError('X', 'msg');
  assert.equal(e.code, 'X');
});

test('redact option can mask sensitive fill values', async () => {
  const page = new FakeInteractions();
  const rec = new BrowserRecorder(page, {
    redact: (params, step) => {
      if (step.kind === 'fill' && params.value !== undefined) {
        return { ...params, value: '<redacted>' };
      }
      return params;
    }
  });
  await rec.fill({ kind: 'css', value: '#password' }, 's3cr3t');
  const script = rec.getScript();
  const fillStep = script.find(s => s.kind === 'fill');
  assert.equal(fillStep.params.value, '<redacted>', 'sensitive value must be redacted');
});

test('replay redacts are not stored in the recorded script by default', async () => {
  const page = new FakeInteractions();
  const rec = new BrowserRecorder(page); // no redact
  await rec.fill({ kind: 'css', value: '#email' }, 'user@example.com');
  const script = rec.getScript();
  const fillStep = script.find(s => s.kind === 'fill');
  assert.equal(fillStep.params.value, 'user@example.com', 'default: value preserved when no redactor');
});
