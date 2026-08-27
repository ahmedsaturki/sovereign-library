// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { LocatorAssertions, Snapshot, AssertionsError, expect } from '../src/index.js';

/** Fake locator that records evaluation counts and returns scripted state. */
class FakeLocator {
  constructor(script) {
    this.script = script; // function(attemptIndex) => state object or throws
    this.calls = 0;
  }
  async isVisible() { this.calls++; return this.script(this.calls - 1).visible; }
  async isEnabled() { this.calls++; return this.script(this.calls - 1).enabled; }
  async textContent() { this.calls++; return this.script(this.calls - 1).text; }
  async value() { this.calls++; return this.script(this.calls - 1).value; }
  async getAttribute(name) { this.calls++; const s = this.script(this.calls - 1); return s.attrs ? s.attrs[name] : undefined; }
  async count() { this.calls++; return this.script(this.calls - 1).count; }
}

const visible = () => ({ visible: true });
const hidden = () => ({ visible: false });
const enabled = () => ({ enabled: true });
const disabled = () => ({ enabled: false });

// ---- RETRY CLASSIFICATION ----

test('retryable NOT_VISIBLE retries until deadline', async () => {
  const loc = new FakeLocator(() => hidden());
  const a = new LocatorAssertions(loc, { timeoutMs: 200, soft: false });
  await assert.rejects(() => a.toBeVisible(), e => e.code === 'NOT_VISIBLE' && e.retryable === true);
  assert.ok(loc.calls > 1, `expected multiple evaluations, got ${loc.calls}`);
});

test('retryable NOT_ENABLED retries until deadline', async () => {
  const loc = new FakeLocator(() => disabled());
  const a = new LocatorAssertions(loc, { timeoutMs: 200 });
  await assert.rejects(() => a.toBeEnabled(), e => e.code === 'NOT_ENABLED' && e.retryable === true);
  assert.ok(loc.calls > 1);
});

test('retryable TEXT_MISMATCH retries', async () => {
  const loc = new FakeLocator(() => ({ text: 'actual' }));
  const a = new LocatorAssertions(loc, { timeoutMs: 200 });
  await assert.rejects(() => a.toHaveText('expected'), e => e.code === 'TEXT_MISMATCH' && e.retryable === true);
  assert.ok(loc.calls > 1);
});

test('retryable VALUE_MISMATCH retries', async () => {
  const loc = new FakeLocator(() => ({ value: 'actual' }));
  const a = new LocatorAssertions(loc, { timeoutMs: 200 });
  await assert.rejects(() => a.toHaveValue('expected'), e => e.code === 'VALUE_MISMATCH' && e.retryable === true);
  assert.ok(loc.calls > 1);
});

test('retryable ATTRIBUTE_MISMATCH retries', async () => {
  const loc = new FakeLocator(() => ({ attrs: { id: 'actual' } }));
  const a = new LocatorAssertions(loc, { timeoutMs: 200 });
  await assert.rejects(() => a.toHaveAttribute('id', 'expected'), e => e.code === 'ATTRIBUTE_MISMATCH' && e.retryable === true);
  assert.ok(loc.calls > 1);
});

test('retryable COUNT_MISMATCH retries', async () => {
  const loc = new FakeLocator(() => ({ count: 3 }));
  const a = new LocatorAssertions(loc, { timeoutMs: 200 });
  await assert.rejects(() => a.toHaveCount(1), e => e.code === 'COUNT_MISMATCH' && e.retryable === true);
  assert.ok(loc.calls > 1);
});

test('success path does not retry beyond first success', async () => {
  const loc = new FakeLocator(() => visible());
  const a = new LocatorAssertions(loc, { timeoutMs: 200 });
  await a.toBeVisible();
  assert.equal(loc.calls, 1);
});

// ---- NON-RETRYABLE CASES ----

test('non-retryable NOT_HIDDEN surfaces immediately (single evaluation)', async () => {
  const loc = new FakeLocator(() => visible());
  const a = new LocatorAssertions(loc, { timeoutMs: 5000 });
  const start = Date.now();
  const err = await assert.rejects(() => a.toBeHidden(), e => e.code === 'NOT_HIDDEN' && e.retryable === false);
  assert.equal(loc.calls, 1, 'must NOT retry a non-retryable assertion');
  // Minimal delay: must not sleep the poll interval
  assert.ok(Date.now() - start < 4000, 'must fail fast without full timeout');
});

test('non-retryable NOT_DISABLED surfaces immediately', async () => {
  const loc = new FakeLocator(() => enabled());
  const a = new LocatorAssertions(loc, { timeoutMs: 5000 });
  await assert.rejects(() => a.toBeDisabled(), e => e.code === 'NOT_DISABLED' && e.retryable === false);
  assert.equal(loc.calls, 1);
});

test('non-retryable INVALID_OPTION (bad attribute name) surfaces immediately', async () => {
  const loc = new FakeLocator(() => ({}));
  const a = new LocatorAssertions(loc, { timeoutMs: 5000 });
  await assert.rejects(() => a.toHaveAttribute('', 'x'), e => e.code === 'INVALID_OPTION' && e.retryable === false);
  assert.equal(loc.calls, 0, 'validation must happen before any locator evaluation');
});

test('non-retryable INVALID_OPTION (bad count) surfaces immediately', async () => {
  const loc = new FakeLocator(() => ({}));
  const a = new LocatorAssertions(loc, { timeoutMs: 5000 });
  await assert.rejects(() => a.toHaveCount(-1), e => e.code === 'INVALID_OPTION' && e.retryable === false);
  assert.equal(loc.calls, 0);
});

test('non-retryable INVALID_SNAPSHOT (malformed) surfaces immediately', () => {
  const s = new Snapshot();
  assert.throws(() => s.capture(42), e => e.code === 'INVALID_SNAPSHOT' && e.retryable === false);
});

// ---- UNEXPECTED ERRORS ----

test('unexpected (non-AssertionsError) locator failure propagates immediately, not retried', async () => {
  const loc = {
    async isVisible() { throw new Error('session crashed'); },
  };
  const a = new LocatorAssertions(loc, { timeoutMs: 5000 });
  const start = Date.now();
  const err = await assert.rejects(() => a.toBeVisible(), e => e.message === 'session crashed');
  assert.ok(Date.now() - start < 1000, 'unexpected error must not be retried');
  assert.equal(err instanceof AssertionsError, false, 'unexpected errors stay unwrapped');
});

test('AssertionsError with retryable=false is surfaced once, not retried', async () => {
  // An assertion that throws a non-retryable AssertionsError inside fn
  const loc = {
    async isVisible() { throw new AssertionsError('NOT_VISIBLE', 'x', { retryable: false }); },
  };
  const a = new LocatorAssertions(loc, { timeoutMs: 5000 });
  const start = Date.now();
  await assert.rejects(() => a.toBeVisible(), e => e.code === 'NOT_VISIBLE' && e.retryable === false);
  assert.ok(Date.now() - start < 1000);
});

// ---- SOFT ASSERTIONS ----

test('soft assertion collects failures, reports at end, no throw', async () => {
  const loc = new FakeLocator(() => hidden());
  const a = new LocatorAssertions(loc, { timeoutMs: 100, soft: true });
  await a.toBeVisible(); // would throw if not soft
  assert.equal(a.hasSoftErrors(), true);
  const errs = a.softErrors();
  assert.ok(Array.isArray(errs));
  assert.equal(errs.length, 1);
  assert.equal(errs[0].code, 'NOT_VISIBLE');
  assert.equal(Object.isFrozen(errs), true, 'softErrors result must be immutable');
});

test('soft assertion: non-retryable is collected once, not retried', async () => {
  const loc = new FakeLocator(() => visible());
  const a = new LocatorAssertions(loc, { timeoutMs: 5000, soft: true });
  await a.toBeHidden();
  assert.equal(loc.calls, 1);
  assert.equal(a.softErrors().length, 1);
});

test('softErrors cleared explicitly', async () => {
  const loc = new FakeLocator(() => hidden());
  const a = new LocatorAssertions(loc, { timeoutMs: 50, soft: true });
  await a.toBeVisible();
  assert.equal(a.softErrors().length, 1);
  a.clearSoftErrors();
  assert.equal(a.hasSoftErrors(), false);
  assert.deepEqual(a.softErrors(), []);
});

// ---- DEADLINE / TIMEOUT VALIDATION (§10) ----

test('timeoutMs=0 is accepted and fails immediately', async () => {
  const loc = new FakeLocator(() => hidden());
  const a = new LocatorAssertions(loc, { timeoutMs: 0 });
  await assert.rejects(() => a.toBeVisible(), e => e.code === 'NOT_VISIBLE');
  assert.ok(loc.calls >= 1);
});

test('negative timeout is rejected at construction', () => {
  const loc = new FakeLocator(() => visible());
  assert.throws(() => new LocatorAssertions(loc, { timeoutMs: -1 }), e => e.code === 'INVALID_TIMEOUT' && e.retryable === false);
});

test('NaN timeout is rejected at construction', () => {
  const loc = new FakeLocator(() => visible());
  assert.throws(() => new LocatorAssertions(loc, { timeoutMs: NaN }), e => e.code === 'INVALID_TIMEOUT');
});

test('Infinity timeout is rejected at construction', () => {
  const loc = new FakeLocator(() => visible());
  assert.throws(() => new LocatorAssertions(loc, { timeoutMs: Infinity }), e => e.code === 'INVALID_TIMEOUT');
});

test('fractional timeout is rejected at construction', () => {
  const loc = new FakeLocator(() => visible());
  assert.throws(() => new LocatorAssertions(loc, { timeoutMs: 1.5 }), e => e.code === 'INVALID_TIMEOUT');
});

test('excessive timeout (>24h) is rejected', () => {
  const loc = new FakeLocator(() => visible());
  assert.throws(() => new LocatorAssertions(loc, { timeoutMs: 86_400_001 }), e => e.code === 'INVALID_TIMEOUT');
});

// ---- SNAPSHOT CONTRACT A (§6/§7/§9) ----

test('identical snapshots are equal', () => {
  const s = new Snapshot();
  const a = s.capture('<div>x</div>');
  const b = s.capture('<div>x</div>');
  assert.equal(s.diff(a, b).equal, true);
});

test('differing tags are not equal', () => {
  const s = new Snapshot();
  assert.equal(s.diff('<div>x</div>', '<span>x</span>').equal, false);
});

test('differing text is not equal', () => {
  const s = new Snapshot();
  assert.equal(s.diff('<p>a</p>', '<p>b</p>').equal, false);
});

test('insignificant leading/trailing whitespace does not change equality', () => {
  const s = new Snapshot();
  assert.equal(s.diff('  <div>x</div>  ', '<div>x</div>').equal, true);
});

test('meaningful internal whitespace DOES change equality (Contract A is exact HTML)', () => {
  const s = new Snapshot();
  // Internal whitespace is meaningful in raw HTML contract; by design not normalised.
  assert.equal(s.diff('<div>a b</div>', '<div>a  b</div>').equal, false);
});

test('attribute ordering in HTML is meaningful (Contract A is exact HTML-string)', () => {
  const s = new Snapshot();
  // Contract A compares the exact trimmed HTML string; canonical-json
  // normalises object key order, not HTML attribute order inside a string.
  assert.equal(s.diff('<a href="y" id="x">t</a>', '<a id="x" href="y">t</a>').equal, false);
});

test('attribute value change is detected', () => {
  const s = new Snapshot();
  assert.equal(s.diff('<a id="x">t</a>', '<a id="z">t</a>').equal, false);
});

test('nested structure change is detected', () => {
  const s = new Snapshot();
  assert.equal(s.diff('<ul><li>a</li></ul>', '<ul><li>a</li><li>b</li></ul>').equal, false);
});

test('malformed input throws INVALID_SNAPSHOT (not silently accepted)', () => {
  const s = new Snapshot();
  assert.throws(() => s.capture(null), e => e.code === 'INVALID_SNAPSHOT');
  assert.throws(() => s.capture(123), e => e.code === 'INVALID_SNAPSHOT');
});

test('snapshot immutability: captured object is frozen', () => {
  const s = new Snapshot();
  const snap = s.capture('<div>x</div>');
  assert.equal(Object.isFrozen(snap), true);
  assert.equal(Object.isFrozen(s.diff('<div>x</div>', '<div>x</div>')), true);
});

test('deterministic repeated capture: same input -> identical stable', () => {
  const s = new Snapshot();
  const a = s.capture('<div>x</div>');
  const b = s.capture('<div>x</div>');
  assert.equal(a.stable, b.stable);
});

test('deterministic diff result for equal inputs', () => {
  const s = new Snapshot();
  const r1 = s.diff('<div>x</div>', '<div>x</div>');
  const r2 = s.diff('<div>x</div>', '<div>x</div>');
  assert.deepEqual(r1, r2);
});

// ---- ERROR CONTRACT (§11) ----

test('AssertionsError preserves code, retryable, cause, immutable fields', () => {
  const cause = new Error('root');
  const e = new AssertionsError('X', 'msg', { retryable: true, cause });
  assert.equal(e.code, 'X');
  assert.equal(e.retryable, true);
  assert.equal(e.cause, cause);
  assert.equal(Object.isFrozen(e), true);
  assert.equal(e.message, 'msg');
  // mutation must fail (frozen) — verify it throws in strict mode
  assert.throws(() => { e.code = 'Y'; }, TypeError);
});

test('default retryable is false', () => {
  const e = new AssertionsError('Z', 'm');
  assert.equal(e.retryable, false);
});

// ---- self-contained canonicalization (SPEC == impl, no monorepo import) ----

test('snapshot stable output matches canonical-json cube contract (key-stable)', async () => {
  const s = new Snapshot();
  // Independent canonical-json cube reference for cross-check (test-only import,
  // not a runtime dependency of the package).
  const { canonicalStringify: ref } = await import('../../canonical-json/src/index.js');
  const sample = '<div>x</div>';
  const a = s.capture(sample);
  const expected = ref({ html: sample.trim() });
  assert.equal(a.stable, expected, 'inline canonicalizer must match canonical-json contract');
});

test('canonicalization is deterministic and key-order independent', () => {
  const s = new Snapshot();
  const a = s.capture('<a id="x" href="y">t</a>');
  const b = s.capture('<a id="x" href="y">t</a>');
  assert.equal(a.stable, b.stable);
  // stable form uses sorted object keys: {"html":"..."}
  assert.ok(a.stable.startsWith('{"html":'));
});
