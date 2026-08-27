// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualTester, VisualError, tokenize } from '../src/index.js';

test('capture normalizes tag case and attribute order', () => {
  const vt = new VisualTester();
  const a = vt.capture('<DIV Class="x y" id="1">Hi</DIV>');
  const b = vt.capture('<div id="1" class="y x">Hi</div>');
  assert.equal(a.canonical, b.canonical, 'attribute order + class sorting + tag case should be canonical');
});

test('diff detects added nodes', () => {
  const vt = new VisualTester();
  const before = vt.capture('<div><span>a</span></div>');
  const after = vt.capture('<div><span>a</span><span>b</span></div>');
  const d = vt.diff(before, after);
  assert.equal(d.equal, false);
  assert.equal(d.addedCount, 1);
});

test('diff detects removed nodes', () => {
  const vt = new VisualTester();
  const before = vt.capture('<ul><li>1</li><li>2</li></ul>');
  const after = vt.capture('<ul><li>1</li></ul>');
  const d = vt.diff(before, after);
  assert.equal(d.removedCount, 1);
});

test('identical html yields equal snapshots', () => {
  const vt = new VisualTester();
  const d = vt.diff('<p class="a">x</p>', '<p class="a">x</p>');
  assert.equal(d.equal, true);
});

test('baseline/compare golden-file style', () => {
  const vt = new VisualTester();
  vt.baseline('home', '<nav>menu</nav><main>content</main>');
  const d = vt.compare('home', '<nav>menu</nav><main>content!</main>');
  assert.equal(d.equal, false);
});

test('tokenize rejects non-string', () => {
  assert.throws(() => tokenize(42), err => err instanceof VisualError && err.code === 'INVALID_INPUT');
});

test('baseline rejects empty name', () => {
  const vt = new VisualTester();
  assert.throws(() => vt.baseline('', '<x/>'), err => err.code === 'INVALID_NAME');
});

test('compare on missing baseline throws', () => {
  const vt = new VisualTester();
  assert.throws(() => vt.compare('nope', '<x/>'), err => err.code === 'NO_BASELINE');
});

test('errors carry stable code', () => {
  const e = new VisualError('X', 'msg');
  assert.equal(e.code, 'X');
});
