import test from 'node:test';
import assert from 'node:assert/strict';
import { createProcessSupervisor } from '../src/index.js';

test('native child lifecycle starts, inspects, and stops without shell execution', async () => {
  const supervisor = createProcessSupervisor({
    command: process.execPath,
    args: ['-e', 'setTimeout(() => {}, 10000)'],
    stopGracePeriodMs: 100,
  });
  try {
    const started = await supervisor.start();
    assert.equal(started.state, 'running');
    assert.equal(typeof started.childPid, 'number');
    assert.equal(started.childPid > 0, true);
    const stopped = await supervisor.stop();
    assert.equal(stopped.state, 'idle');
    assert.equal(stopped.childPid, null);
  } finally {
    await supervisor.close();
  }
});
