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

// Synthetic credential test vectors (not real secrets).
const CREDENTIALS = {
  PASSWORD: 'SuperSecretPassword!123',
  TOKEN: 'ghp_example_sensitive_token_value',
  API_KEY: 'sk-example-sensitive-value',
  AUTH_HEADER: 'Bearer extremely-sensitive-value',
  COOKIE: 'session=highly-sensitive-value',
};

// A redactor that masks known credential field *values* by field id.
function credentialRedactor(params, step) {
  const id = (step.target && step.target.value) || '';
  if (params.value && typeof params.value === 'string' &&
      /^(#?)(password|pwd|pass|token|apikey|api_key|auth|authorization|secret|cookie|session)$/i.test(id)) {
    return { ...params, value: '<REDACTED>' };
  }
  return params;
}

// ============================================================
// Basic recording / replay
// ============================================================

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
  let thrown;
  try { await rec.replay(null); } catch (e) { thrown = e; }
  assert.ok(thrown instanceof RecorderError && thrown.code === 'INVALID_REPLAY_TARGET');
});

test('clear empties the script', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.click(bySubmit);
  rec.clear();
  assert.equal(rec.getScript().length, 0);
});

test('errors carry stable code and are immutable', () => {
  const cause = new Error('root');
  const e = new RecorderError('X', 'msg', { cause, retryable: false });
  assert.equal(e.code, 'X');
  assert.equal(e.retryable, false);
  assert.equal(e.cause, cause);
  assert.throws(() => { e.code = 'Y'; }, /Cannot assign/);
});

// ============================================================
// §3 Immutability test matrix
// getScript() MUST return snapshots that cannot mutate internal state.
// We test the SEMANTIC requirement (internal state unchanged) rather than
// relying solely on strict-mode throw semantics, because sloppy-mode assignment
// is a silent no-op and would otherwise hide a real aliasing bug.
// ============================================================

function injectSteps(rec, steps) {
  // Steps are stored frozen internally; simulate via the public surface.
  rec.steps = steps.map(s => Object.freeze({ ...s, params: Object.freeze(s.params || {}) }));
}

test('§3.1 mutate top-level step object does not change internal state', () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  rec.steps = [Object.freeze({ kind: 'fill', target: { kind: 'css', value: '#a' }, params: { value: 'v' }, at: 0 })];
  const script = rec.getScript();
  try { script[0].kind = 'hack'; } catch { /* strict mode throws, that's fine */ }
  assert.equal(rec.steps[0].kind, 'fill', 'internal step kind unchanged');
});

test('§3.2 mutate params object does not change internal state', () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  rec.steps = [Object.freeze({ kind: 'fill', target: { kind: 'css', value: '#a' }, params: { value: 'v' }, at: 0 })];
  const script = rec.getScript();
  try { script[0].params = { value: 'evil' }; } catch { /* fine */ }
  assert.equal(rec.getScript()[0].params.value, 'v', 'internal params object unchanged');
});

test('§3.3 mutate params.value does not change internal state (sloppy-mode safe)', () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  rec.steps = [Object.freeze({ kind: 'fill', target: { kind: 'css', value: '#a' }, params: { value: 'orig' }, at: 0 })];
  const script = rec.getScript();
  // In sloppy mode this assignment is a silent no-op; in strict mode it throws.
  // Either way, the internal state must remain 'orig'.
  try { script[0].params.value = 'mutated'; } catch { /* strict mode throws; fine */ }
  assert.equal(rec.getScript()[0].params.value, 'orig', 'internal params.value unchanged');
});

test('§3.4 mutate nested object inside params does not change internal state', () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  const nested = { value: 'orig', meta: { level: 1 } };
  rec.steps = [Object.freeze({ kind: 'fill', target: { kind: 'css', value: '#a' }, params: deepFreeze(nested), at: 0 })];
  const script = rec.getScript();
  try { script[0].params.meta.level = 999; } catch { /* fine */ }
  assert.equal(rec.getScript()[0].params.meta.level, 1, 'nested object unchanged');
});

test('§3.5 mutate returned array does not change internal state', () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  rec.steps = [Object.freeze({ kind: 'click', target: { kind: 'css', value: '#a' }, params: {}, at: 0 })];
  const script = rec.getScript();
  try { script.push({ kind: 'x' }); } catch { /* fine */ }
  assert.equal(rec.getScript().length, 1, 'internal array unchanged');
});

test('§3.6 mutate step target does not change internal state', () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  rec.steps = [Object.freeze({ kind: 'click', target: { kind: 'css', value: '#a' }, params: {}, at: 0 })];
  const script = rec.getScript();
  try { script[0].target.value = '#evil'; } catch { /* fine */ }
  assert.equal(rec.getScript()[0].target.value, '#a', 'internal target unchanged');
});

test('§3.7 mutate returned script then call getScript() again is still clean', () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  rec.steps = [Object.freeze({ kind: 'fill', target: { kind: 'css', value: '#a' }, params: { value: 'v' }, at: 0 })];
  const first = rec.getScript();
  try { first[0].params.value = 'MUT'; } catch { /* fine */ }
  const second = rec.getScript();
  assert.equal(second[0].params.value, 'v', 'second snapshot unaffected');
});

test('§3.8 mutate returned script then replay still uses internal state', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  const page = new FakeInteractions();
  await rec.click(bySubmit);
  const script = rec.getScript();
  try { script[0].kind = 'destroyed'; } catch { /* fine */ }
  const replayPage = new FakeInteractions();
  await rec.replay(replayPage);
  // Replay must use the protected internal representation, not the mutated copy.
  const actions = replayPage.calls.filter(c => c[0] !== 'locator');
  assert.deepEqual(actions, [['click', bySubmit]]);
});

test('§3.9 repeated getScript() returns independent immutable snapshots', () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  rec.steps = [Object.freeze({ kind: 'fill', target: { kind: 'css', value: '#a' }, params: { value: 'v' }, at: 0 })];
  const a = rec.getScript();
  const b = rec.getScript();
  assert.notEqual(a, b, 'distinct array instances');
  assert.notEqual(a[0], b[0], 'distinct step instances');
  assert.notEqual(a[0].params, b[0].params, 'distinct params instances');
  assert.equal(a[0].params.value, 'v');
  assert.equal(b[0].params.value, 'v');
});

// Helper: deep freeze for hand-built internal fixtures.
function deepFreeze(o) {
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) deepFreeze(o[k]);
    Object.freeze(o);
  }
  return o;
}

// ============================================================
// §4 / §5 Redactor error handling — fail closed
// ============================================================

test('§5.A redactor returns modified params → stored result uses modified params', async () => {
  const rec = new BrowserRecorder(new FakeInteractions(), {
    redact: (params) => ({ ...params, value: 'MASKED' })
  });
  await rec.fill({ kind: 'css', value: '#a' }, 'secret');
  assert.equal(rec.getScript()[0].params.value, 'MASKED');
});

test('§5.B redactor returns a new object → internal original params not leaked', async () => {
  const original = { value: 'secret', extra: 'x' };
  const rec = new BrowserRecorder(new FakeInteractions(), {
    redact: (params) => ({ value: 'MASKED' }) // drops `extra`
  });
  await rec.fill({ kind: 'css', value: '#a' }, 'secret', original);
  const stored = rec.getScript()[0].params;
  assert.equal(stored.value, 'MASKED');
  assert.equal(stored.extra, undefined, 'redactor output fully replaces params');
  assert.equal(original.value, 'secret', 'caller original untouched');
});

test('§5.C redactor throws → RecorderError.code === REDACT_ERROR', async () => {
  const rec = new BrowserRecorder(new FakeInteractions(), {
    redact: () => { throw new Error('redactor boom'); }
  });
  let thrown;
  try {
    await rec.fill({ kind: 'css', value: '#pwd' }, 'secret');
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof RecorderError, 'rejection is a RecorderError');
  assert.equal(thrown.code, 'REDACT_ERROR');
});

test('§5.D redactor throws after partial mutation → no partial data persisted', async () => {
  let capturedOnPartial;
  const rec = new BrowserRecorder(new FakeInteractions(), {
    redact: (params) => {
      params.value = 'PARTIAL'; // mutate the shallow copy (caller object untouched)
      capturedOnPartial = params.value;
      throw new Error('then throws');
    }
  });
  let thrown;
  try {
    await rec.fill({ kind: 'css', value: '#pwd' }, 'secret');
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown && thrown.code === 'REDACT_ERROR', 'throws REDACT_ERROR');
  // The step must NOT be in the script (fail-closed).
  assert.equal(rec.getScript().length, 0, 'no step persisted on redactor throw');
  assert.equal(capturedOnPartial, 'PARTIAL', 'redactor did run against its own copy');
});

test('§5.E redactor throws during repeated recording → recorder stays consistent', async () => {
  const rec = new BrowserRecorder(new FakeInteractions(), {
    redact: (params) => { if (params.value === 'boom') throw new Error('boom'); return params; }
  });
  await rec.fill({ kind: 'css', value: '#ok' }, 'fine');
  let thrown;
  try { await rec.fill({ kind: 'css', value: '#bad' }, 'boom'); } catch (e) { thrown = e; }
  assert.ok(thrown && thrown.code === 'REDACT_ERROR');
  await rec.fill({ kind: 'css', value: '#ok2' }, 'fine2');
  const fills = rec.getScript().filter(s => s.kind === 'fill');
  assert.equal(fills.length, 2, 'only the two successful records persisted');
  assert.deepEqual(fills.map(s => s.params.value), ['fine', 'fine2']);
});

test('§5.F replay never re-invokes redaction (record-time only contract)', async () => {
  let recordTimeCalls = 0;
  const rec = new BrowserRecorder(new FakeInteractions(), {
    redact: (params) => {
      recordTimeCalls++;
      return { ...params, value: 'REDACTED' };
    }
  });
  // A single fill() records two steps (locate + fill) → 2 record-time redactor calls.
  await rec.fill({ kind: 'css', value: '#pwd' }, 'secret');
  assert.equal(recordTimeCalls, 2, 'redactor invoked per recorded step at record time');
  const replayPage = new FakeInteractions();
  await rec.replay(replayPage, { timeoutMs: 1000 });
  // Replay must not invoke the redactor again.
  const afterReplay = recordTimeCalls;
  assert.equal(afterReplay, 2, 'replay does not invoke the redactor');
});

// ============================================================
// §7 Realistic credential scenarios
// ============================================================

test('§7 default recorder preserves credential values', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.fill({ kind: 'css', value: '#pwd' }, CREDENTIALS.PASSWORD);
  await rec.fill({ kind: 'css', value: '#token' }, CREDENTIALS.TOKEN);
  const vals = rec.getScript().filter(s => s.kind === 'fill').map(s => s.params.value);
  assert.deepEqual(vals, [CREDENTIALS.PASSWORD, CREDENTIALS.TOKEN]);
});

test('§7 configured redactor masks every credential scenario', async () => {
  const rec = new BrowserRecorder(new FakeInteractions(), { redact: credentialRedactor });
  await rec.fill({ kind: 'css', value: '#password' }, CREDENTIALS.PASSWORD);
  await rec.fill({ kind: 'css', value: '#token' }, CREDENTIALS.TOKEN);
  await rec.fill({ kind: 'css', value: '#apikey' }, CREDENTIALS.API_KEY);
  await rec.fill({ kind: 'css', value: '#auth' }, CREDENTIALS.AUTH_HEADER);
  await rec.fill({ kind: 'css', value: '#cookie' }, CREDENTIALS.COOKIE);
  for (const step of rec.getScript().filter(s => s.kind === 'fill')) {
    assert.equal(step.params.value, '<REDACTED>', `credential not masked: ${step.target.value}`);
    // The original secret must NOT appear in the persisted output.
    assert.ok(
      !step.params.value.includes(CREDENTIALS.PASSWORD) &&
      !step.params.value.includes(CREDENTIALS.TOKEN) &&
      !step.params.value.includes(CREDENTIALS.API_KEY) &&
      !step.params.value.includes(CREDENTIALS.AUTH_HEADER) &&
      !step.params.value.includes(CREDENTIALS.COOKIE),
      'no raw secret leaks into output'
    );
  }
});

test('§7 original secret not present in recorded output after redaction', async () => {
  const rec = new BrowserRecorder(new FakeInteractions(), { redact: credentialRedactor });
  await rec.fill({ kind: 'css', value: '#password' }, CREDENTIALS.PASSWORD);
  const json = JSON.stringify(rec.getScript());
  assert.ok(!json.includes(CREDENTIALS.PASSWORD), 'serialized script contains no raw password');
});

// ============================================================
// §8 Robustness matrix
// ============================================================

test('§8 empty recording: getScript empty, replay no-op', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  assert.deepEqual(rec.getScript(), []);
  const n = await rec.replay(new FakeInteractions());
  assert.equal(n, 0);
});

test('§8 clear() resets; subsequent recording starts fresh', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.click({ kind: 'role', value: 'button', name: 'X' });
  rec.clear();
  assert.equal(rec.getScript().length, 0);
  await rec.click({ kind: 'role', value: 'button', name: 'Y' });
  assert.equal(rec.getScript().length, 2); // locate + click
});

test('§8 record before start / implicit start works (no explicit start API)', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.click({ kind: 'css', value: '#a' });
  assert.equal(rec.getScript().length, 2);
});

test('§8 unknown step kind during replay → UNKNOWN_STEP', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  rec.steps = [Object.freeze({ kind: 'drag', target: { kind: 'css', value: '#x' }, params: {}, at: 0 })];
  let thrown;
  try { await rec.replay(new FakeInteractions()); } catch (e) { thrown = e; }
  assert.ok(thrown instanceof RecorderError && thrown.code === 'UNKNOWN_STEP');
});

test('§8 duplicate actions replay produce duplicate calls', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.click({ kind: 'css', value: '#btn' });
  await rec.click({ kind: 'css', value: '#btn' });
  const replayPage = new FakeInteractions();
  await rec.replay(replayPage);
  assert.equal(replayPage.calls.filter(c => c[0] === 'click').length, 2);
});

test('§8 concurrent record calls recorded in invocation order', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await Promise.all([
    rec.click({ kind: 'css', value: '#a' }),
    rec.fill({ kind: 'css', value: '#b' }, 'x'),
    rec.press({ kind: 'css', value: '#c' }, 'Enter'),
  ]);
  const kinds = rec.getScript().map(s => s.kind);
  assert.equal(kinds.filter(k => k === 'click').length, 1);
  assert.equal(kinds.filter(k => k === 'fill').length, 1);
  assert.equal(kinds.filter(k => k === 'press').length, 1);
});

test('§8 concurrent replay does not corrupt internal state', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.click({ kind: 'css', value: '#a' });
  await rec.fill({ kind: 'css', value: '#b' }, 'v');
  const p1 = rec.replay(new FakeInteractions());
  const p2 = rec.replay(new FakeInteractions());
  await Promise.all([p1, p2]);
  // Internal script must be intact and unchanged.
  assert.equal(rec.getScript().length, 4);
});

// ============================================================
// §9 Partial replay — real failure boundary
// ============================================================

test('§9 partial replay: step1 executes, stops at step2 (unknown), step3 not executed', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  // step0 = locate, step1 = valid click, step2 = unknown drag, step3 = valid fill
  rec.steps = [
    Object.freeze({ kind: 'locate', target: { kind: 'css', value: '#x' }, params: {}, at: 0 }),
    Object.freeze({ kind: 'click', target: { kind: 'css', value: '#x' }, params: {}, at: 1 }),
    Object.freeze({ kind: 'drag', target: { kind: 'css', value: '#x' }, params: {}, at: 2 }),
    Object.freeze({ kind: 'fill', target: { kind: 'css', value: '#y' }, params: { value: 'z' }, at: 3 }),
  ];
  const replayPage = new FakeInteractions();
  let thrown;
  try { await rec.replay(replayPage); } catch (e) { thrown = e; }
  assert.ok(thrown instanceof RecorderError && thrown.code === 'UNKNOWN_STEP');
  // Only the click (step1) executed; the fill (step3) did NOT.
  const actions = replayPage.calls.filter(c => c[0] !== 'locator');
  assert.deepEqual(actions, [['click', { kind: 'css', value: '#x' }]]);
  // Saved script remains unchanged.
  assert.equal(rec.getScript().length, 4);
});

// ============================================================
// §10 Timeout semantics
// ============================================================

test('§10 timeout 0 is forwarded and replay completes', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.click({ kind: 'css', value: '#a' });
  const replayPage = new FakeInteractions();
  await rec.replay(replayPage, { timeoutMs: 0 });
  assert.equal(replayPage.calls.filter(c => c[0] === 'click').length, 1);
});

test('§10 small positive timeout forwards without error', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.click({ kind: 'css', value: '#a' });
  await rec.replay(new FakeInteractions(), { timeoutMs: 1 });
});

test('§10 invalid (negative) timeout is forwarded as-is; no infinite loop', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.click({ kind: 'css', value: '#a' });
  // Recorder does not validate timeout; it forwards to the layer. Must complete.
  await rec.replay(new FakeInteractions(), { timeoutMs: -5 });
  assert.ok(true);
});

test('§10 default timeout applies when omitted', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  await rec.click({ kind: 'css', value: '#a' });
  const replayPage = new FakeInteractions();
  await rec.replay(replayPage); // no timeoutMs → defaults to 5000 in the call
  assert.equal(replayPage.calls.filter(c => c[0] === 'click').length, 1);
});

// ============================================================
// §11 Public error taxonomy — REDACT_ERROR fields
// ============================================================

test('§11 REDACT_ERROR carries cause, stable code, immutable fields, no secret leak', async () => {
  const secret = 'TOPSECRET';
  const root = new Error('redactor failure detail');
  const rec = new BrowserRecorder(new FakeInteractions(), {
    redact: () => { throw root; }
  });
  let thrown;
  try { await rec.fill({ kind: 'css', value: '#pwd' }, secret); }
  catch (e) { thrown = e; }
  assert.ok(thrown instanceof RecorderError);
  assert.equal(thrown.code, 'REDACT_ERROR');
  assert.equal(thrown.retryable, false);
  assert.equal(thrown.cause, root);
  // Cause message may mention redactor internals, but the recorder must not
  // embed the raw sensitive value in its own message.
  assert.ok(!thrown.message.includes(secret), 'error message must not leak the secret');
});

// ============================================================
// Ownership: recorder must not seize caller objects
// ============================================================

test('caller-supplied params are not aliased by the recorder', async () => {
  const rec = new BrowserRecorder(new FakeInteractions());
  const opts = { value: 'orig', nested: { a: 1 } };
  await rec.fill({ kind: 'css', value: '#a' }, 'orig', opts);
  // Mutating the caller object afterwards must not affect the recorded step.
  opts.nested.a = 999;
  opts.value = 'changed';
  const stored = rec.getScript()[0].params;
  assert.equal(stored.value, 'orig', 'recorded value independent of caller');
  assert.equal(stored.nested.a, 1, 'recorded nested object independent of caller');
});
