import test from 'node:test';
import assert from 'node:assert/strict';
import { run, text, ProcessCubeError } from '../src/index.js';

const node = process.execPath;

test('runs argv without a shell and captures stdout/stderr', async () => {
  const result = await run(node, { args: ['-e', "process.stdout.write('out'); process.stderr.write('err')"] });
  assert.equal(result.success, true);
  assert.equal(result.code, 0);
  assert.equal(text(result.stdout), 'out');
  assert.equal(text(result.stderr), 'err');
});

test('returns non-zero exit codes without converting them into spawn errors', async () => {
  const result = await run(node, { args: ['-e', 'process.exit(7)'] });
  assert.equal(result.success, false);
  assert.equal(result.code, 7);
  assert.equal(result.signal, null);
});

test('honors cwd and environment', async () => {
  const result = await run(node, {
    args: ['-e', "process.stdout.write(process.cwd() + '|' + process.env.SOVEREIGN_PROCESS_TEST)"],
    cwd: process.cwd(),
    env: { SOVEREIGN_PROCESS_TEST: 'ok' }
  });
  assert.equal(result.success, true);
  assert.match(text(result.stdout), /\|ok$/);
});

test('timeout terminates long-running processes deterministically', async () => {
  await assert.rejects(
    () => run(node, { args: ['-e', 'setTimeout(() => {}, 1000)'], timeoutMs: 25 }),
    error => error instanceof ProcessCubeError && error.code === 'TIMEOUT' && error.retryable === true
  );
});

test('AbortSignal terminates the process', async () => {
  const controller = new AbortController();
  const promise = run(node, { args: ['-e', 'setTimeout(() => {}, 1000)'], timeoutMs: 5000, signal: controller.signal });
  controller.abort();
  const result = await promise;
  assert.equal(result.signal !== null || result.code !== 0, true);
});

test('output limit terminates noisy processes', async () => {
  await assert.rejects(
    () => run(node, { args: ['-e', "process.stdout.write('1234567890')"], maxOutputBytes: 5 }),
    error => error instanceof ProcessCubeError && error.code === 'OUTPUT_TOO_LARGE'
  );
});

test('invalid arguments are deterministic errors', async () => {
  await assert.rejects(
    () => run('', {}),
    error => error instanceof ProcessCubeError && error.code === 'INVALID_COMMAND'
  );
  await assert.rejects(
    () => run(node, { args: ['-e', '0'], timeoutMs: 0 }),
    error => error instanceof ProcessCubeError && error.code === 'INVALID_TIMEOUT'
  );
});

test('missing executable surfaces a typed spawn error', async () => {
  await assert.rejects(
    () => run('__sovereign_missing_process__'),
    error => error instanceof ProcessCubeError && error.code === 'SPAWN_FAILED'
  );
});
