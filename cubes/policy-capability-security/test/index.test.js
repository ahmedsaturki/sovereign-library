import test from 'node:test';
import assert from 'node:assert/strict';
import { PolicyError, createPolicyEngine } from '../src/index.js';

function makeEngine(rules, limits) { return createPolicyEngine({ rules, limits }); }

test('exact, wildcard, and recursive patterns match deterministically', () => {
  const engine = makeEngine([
    { id: 'wild', effect: 'allow', action: 'fs/read', resource: 'doc/*' },
    { id: 'deep', effect: 'allow', action: 'fs/**', resource: 'doc/**' },
  ]);
  assert.equal(engine.evaluate({ action: 'fs/read', resource: 'doc/a' }).allowed, true);
  assert.deepEqual(engine.evaluate({ action: 'fs/read', resource: 'doc/a' }).matchedRuleIds, ['wild', 'deep']);
});

test('precedence is priority, specificity, deny, then id', () => {
  const engine = makeEngine([
    { id: 'allow', effect: 'allow', action: 'fs/read', resource: 'doc/**', priority: 1 },
    { id: 'deny-specific', effect: 'deny', action: 'fs/read', resource: 'doc/secret', priority: 1 },
    { id: 'deny-high', effect: 'deny', action: 'fs/read', resource: 'doc/secret', priority: 2 },
  ]);
  const decision = engine.evaluate({ action: 'fs/read', resource: 'doc/secret' });
  assert.equal(decision.allowed, false);
  assert.equal(decision.winningRuleId, 'deny-high');
});

test('context predicates are explicit and missing keys fail closed', () => {
  const engine = makeEngine([{ id: 'prod', effect: 'allow', action: 'deploy/app', resource: 'app/x', when: { env: 'prod' } }]);
  assert.equal(engine.evaluate({ action: 'deploy/app', resource: 'app/x', context: { env: 'prod' } }).allowed, true);
  assert.equal(engine.evaluate({ action: 'deploy/app', resource: 'app/x', context: {} }).allowed, false);
});

test('no match is deny by default and audit records are immutable', () => {
  const decision = makeEngine([]).evaluate({ action: 'a/b', resource: 'c/d' });
  assert.equal(decision.allowed, false);
  assert.equal(decision.winningRuleId, null);
  assert.ok(Object.isFrozen(decision));
  assert.ok(Object.isFrozen(decision.matchedRuleIds));
});

test('policy snapshots and composition are immutable', () => {
  const a = makeEngine([{ id: 'a', effect: 'allow', action: 'x/**', resource: 'r/**' }]);
  const b = makeEngine([{ id: 'b', effect: 'deny', action: 'x/y', resource: 'r/z' }]);
  const snapshot = a.snapshot();
  const composed = a.compose(b);
  assert.equal(snapshot.rules[0].when && typeof snapshot.rules[0].when, 'object');
  assert.equal(composed.evaluate({ action: 'x/y', resource: 'r/z' }).allowed, false);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.rules));
  assert.ok(Object.isFrozen(snapshot.rules[0]));
  assert.ok(Object.isFrozen(snapshot.rules[0].when));
});

test('accessors, duplicates, malformed patterns, and unsupported values fail closed', () => {
  let evaluated = false;
  const rule = { id: 'x', effect: 'allow', action: 'a/b', resource: 'r/s' };
  Object.defineProperty(rule, 'id', { get() { evaluated = true; return 'x'; }, enumerable: true });
  assert.throws(() => makeEngine([rule]), e => e instanceof PolicyError && e.code === 'INVALID_POLICY');
  assert.equal(evaluated, false);
  assert.throws(() => makeEngine([{ id: 'x', effect: 'allow', action: 'a/**/**', resource: 'r/s' }]), e => e instanceof PolicyError && e.code === 'INVALID_POLICY');
  assert.throws(() => makeEngine([{ id: 'x', effect: 'allow', action: 'a/b', resource: 'r/s' }, { id: 'x', effect: 'deny', action: 'a/b', resource: 'r/s' }]), e => e instanceof PolicyError && e.code === 'INVALID_POLICY');
  assert.throws(() => makeEngine([{ id: 'nested', effect: 'allow', action: 'a/b', resource: 'r/s', when: { self: {} } }]), e => e instanceof PolicyError && e.code === 'INVALID_CONTEXT');
});

test('limits are bounded and later valid calls recover', () => {
  const engine = makeEngine([{ id: 'x', effect: 'allow', action: 'a/b', resource: 'r/s' }], { maxContextKeys: 1 });
  assert.throws(() => engine.evaluate({ action: 'a/b', resource: 'r/s', context: { a: 1, b: 2 } }), e => e.code === 'LIMIT_EXCEEDED');
  assert.equal(engine.evaluate({ action: 'a/b', resource: 'r/s', context: { a: 1 } }).allowed, true);
});

test('rule and context source objects are not mutated', () => {
  const rules = [{ id: 'x', effect: 'allow', action: 'a/b', resource: 'r/s', when: { env: 'prod' } }];
  const before = JSON.stringify(rules);
  const context = { env: 'prod' };
  const contextBefore = JSON.stringify(context);
  const engine = makeEngine(rules);
  engine.evaluate({ action: 'a/b', resource: 'r/s', context });
  assert.equal(JSON.stringify(rules), before);
  assert.equal(JSON.stringify(context), contextBefore);
});
