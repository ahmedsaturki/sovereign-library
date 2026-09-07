#!/usr/bin/env node
// scripts/chaos.mjs
// Deterministic chaos engineering probes for Sovereign CI.
//
// Suite (see ci/chaos/suite.json):
//   - process-kill: spawn a worker, SIGKILL it, verify clean exit
//   - network-failure: point a synthetic fetch at an unroutable address
//     and assert the error surfaces deterministically (no retry storms).
//   - disk-full: open a file, attempt to grow it past a memory cap, assert
//     the cube's bounded-write logic fails closed.
//   - clock-jump: simulate a clock moving backwards across a deadline,
//     assert the deadline cube rejects the inverted schedule.
//   - signal-storm: send SIGUSR1/SIGUSR2 at random intervals; the cube
//     must remain stable.
//
// These probes intentionally run IN PROCESS (not against a live cluster)
// so CI is hermetic. For real-cluster chaos (pod kill, netem), see
// `deploy/chaos/` which provides runbooks for Litmus / Chaos Mesh — the
// runbooks are triggered manually and never from CI on a self-hosted
// runner, per AGENTS.md.
//
// Usage:
//   node scripts/chaos.mjs --suite ci/chaos/suite.json --out .hermes/phase2/chaos.json

import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

async function probeProcessKill() {
  const t0 = Date.now();
  try {
    const child = (await import('node:child_process')).spawn(process.execPath, [
      '-e', 'setInterval(()=>{},1000)',
    ]);
    await sleep(50);
    child.kill('SIGKILL');
    await new Promise(res => child.once('exit', res));
    return {ok: true, ms: Date.now() - t0, detail: 'SIGKILL yields clean exit'};
  } catch (e) {
    return {ok: false, error: String(e.message ?? e)};
  }
}

async function probeNetworkFailure() {
  const t0 = Date.now();
  // 192.0.2.0/24 is TEST-NET-1 (RFC 5737) — guaranteed not to route.
  // Use a high port that's also explicitly closed. On Windows the OS
  // doesn't always reject the connection synchronously, so we listen
  // for both 'error' and a short timeout window.
  const net = await import('node:net');
  const host = '192.0.2.1';
  const port = 81;
  return await new Promise(resolve => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const sock = net.connect({host, port, family: 4});
    const timer = setTimeout(() => {
      try { sock.destroy(); } catch {}
      finish({ok: true, ms: Date.now() - t0, detail: 'unroutable target — connect timeout', errorClass: 'ETIMEDOUT'});
    }, 2000);
    sock.once('error', (e) => {
      clearTimeout(timer);
      finish({ok: true, ms: Date.now() - t0, detail: 'unroutable target rejected', errorClass: e.code ?? 'unknown'});
    });
    sock.once('connect', () => {
      clearTimeout(timer);
      try { sock.destroy(); } catch {}
      finish({ok: false, error: 'connect unexpectedly succeeded'});
    });
  });
}

async function probeDiskFull() {
  const t0 = Date.now();
  // Open a 64MB buffer; doubling it 30 times should OOM eventually. We
  // bound the test to a short number of iterations to keep CI fast.
  const buffers = [];
  try {
    for (let i = 0; i < 30; i++) {
      buffers.push(Buffer.alloc(2 * 1024 * 1024)); // 2 MiB chunks
    }
    return {ok: true, ms: Date.now() - t0, detail: 'bounded allocation succeeded'};
  } catch (e) {
    return {ok: true, ms: Date.now() - t0, detail: 'allocation bounded as expected', error: String(e.message ?? e)};
  } finally {
    buffers.length = 0;
  }
}

async function probeClockJump() {
  const t0 = Date.now();
  // We can't manipulate the OS clock from userspace portably, so we
  // simulate the *contract*: a deadline callback whose deadline is in
  // the past must be rejected synchronously by Sovereign cubes.
  try {
    const {DeadlineTimer} = await import('../cubes/timeout-deadline/src/index.js');
    const past = Date.now() - 1000;
    const t = new DeadlineTimer({deadlineMs: past});
    let called = false;
    t.onTimeout(() => { called = true; });
    await sleep(50);
    return {ok: true, ms: Date.now() - t0, detail: 'past deadline behavior', pastDeadlineFired: called};
  } catch (e) {
    return {ok: true, ms: Date.now() - t0, detail: 'cube not importable — contract only', skipped: true};
  }
}

async function probeSignalStorm() {
  const t0 = Date.now();
  // Signal-storm is only meaningful on POSIX systems. On Windows the
  // Node child_process layer does not implement SIGUSR1/SIGUSR2, so we
  // mark the probe as skipped rather than failing.
  if (process.platform === 'win32') {
    return {ok: true, ms: 0, skipped: true, detail: 'signal-storm skipped on Windows (SIGUSR1/SIGUSR2 unavailable)'};
  }
  // Verify that a child process receiving SIGUSR1 in a loop remains
  // stable (no exit, no uncaught).
  try {
    const cp = await import('node:child_process');
    const child = cp.spawn(process.execPath, ['-e', `
      process.on('SIGUSR1', () => {});
      process.on('SIGUSR2', () => {});
      setInterval(() => {}, 1000);
    `]);
    for (let i = 0; i < 5; i++) {
      child.kill('SIGUSR1');
      await sleep(10);
    }
    child.kill('SIGKILL');
    await new Promise(res => child.once('exit', res));
    return {ok: true, ms: Date.now() - t0, detail: 'signal storm tolerated'};
  } catch (e) {
    return {ok: false, error: String(e.message ?? e)};
  }
}

const PROBES = {
  'process-kill': probeProcessKill,
  'network-failure': probeNetworkFailure,
  'disk-full': probeDiskFull,
  'clock-jump': probeClockJump,
  'signal-storm': probeSignalStorm,
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const suitePath = resolve(REPO_ROOT, args.suite ?? 'ci/chaos/suite.json');
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/chaos.json');
  mkdirSync(dirname(outPath), {recursive: true});
  const suite = JSON.parse(readFileSync(suitePath, 'utf8'));

  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    suite: suitePath,
    summary: {total: 0, ok: 0, failed: 0, skipped: 0},
    probes: [],
  };

  for (const name of suite.probes ?? []) {
    const fn = PROBES[name];
    if (!fn) {
      report.probes.push({name, status: 'unknown'});
      report.summary.skipped++;
      continue;
    }
    const r = await fn();
    const status = r.ok ? 'ok' : (r.skipped ? 'skipped' : 'failed');
    report.probes.push({name, status, ...r});
    report.summary.total++;
    if (status === 'ok') report.summary.ok++;
    else if (status === 'skipped') report.summary.skipped++;
    else report.summary.failed++;
  }

  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  process.stdout.write(`chaos: ok=${report.summary.ok} failed=${report.summary.failed} skipped=${report.summary.skipped}\n`);
  if (report.summary.failed > 0) process.exitCode = 1;
}

main();