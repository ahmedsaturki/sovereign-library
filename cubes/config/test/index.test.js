import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigCubeError, ConfigBuilder, EnvironmentSource, MemorySource, redactConfig } from '../src/index.js';

test('sources use deterministic precedence with environment-like source winning', () => {
  const config = new ConfigBuilder({ sources: [new MemorySource({ PORT: '3000' }), new MemorySource({ PORT: '4000' })] })
    .define('PORT', { type: 'integer', required: true }).build();
  assert.equal(config.PORT, 4000);
});

test('defaults and strict parsing are deterministic', () => {
  const config = new ConfigBuilder({ sources: [] })
    .define('ENABLED', { type: 'boolean', defaultValue: 'true' })
    .define('URL', { type: 'url', defaultValue: 'https://example.com/' })
    .build();
  assert.equal(config.ENABLED, true);
  assert.equal(config.URL, 'https://example.com/');
});

test('required values fail with typed errors', () => {
  assert.throws(
    () => new ConfigBuilder().define('TOKEN', { type: 'string', required: true }).build(),
    error => error instanceof ConfigCubeError && error.code === 'MISSING_REQUIRED'
  );
});

test('namespaces map source keys without changing public keys', () => {
  const env = new EnvironmentSource({ APP_PORT: '8080' });
  const config = new ConfigBuilder({ sources: [env] }).define('PORT', { type: 'integer', namespace: 'APP' }).build();
  assert.equal(config.PORT, 8080);
});

test('snapshots are deeply immutable', () => {
  const config = new ConfigBuilder({ sources: [new MemorySource({ FLAGS: '{"safe":true}' })] })
    .define('FLAGS', { type: 'json' }).build();
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.FLAGS), true);
  assert.throws(() => { config.FLAGS.safe = false; }, TypeError);
});

test('invalid coercion produces deterministic typed errors', () => {
  assert.throws(
    () => new ConfigBuilder({ sources: [new MemorySource({ COUNT: 'abc' })] }).define('COUNT', { type: 'integer' }).build(),
    error => error instanceof ConfigCubeError && error.code === 'INVALID_INTEGER'
  );
});

test('values exceeding limits are rejected before parsing', () => {
  assert.throws(
    () => new ConfigBuilder({ maxValueLength: 4, sources: [new MemorySource({ NAME: '12345' })] }).define('NAME').build(),
    error => error instanceof ConfigCubeError && error.code === 'VALUE_TOO_LARGE'
  );
});

test('secret redaction is safe for nested diagnostics', () => {
  const redacted = redactConfig({ token: 'secret', nested: { password: 'hidden', visible: 1 } });
  assert.equal(redacted.token, '[REDACTED]');
  assert.equal(redacted.nested.password, '[REDACTED]');
  assert.equal(redacted.nested.visible, 1);
  assert.equal(Object.isFrozen(redacted), true);
});

test('invalid keys and source contracts fail deterministically', () => {
  assert.throws(() => new ConfigBuilder().define('bad key'), error => error.code === 'INVALID_KEY');
  assert.throws(() => new MemorySource([]), error => error.code === 'INVALID_SOURCE');
});
