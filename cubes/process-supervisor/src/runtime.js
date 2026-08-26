import { spawn as nativeSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const DEFAULTS = Object.freeze({
  stopGracePeriodMs: 5_000,
  maxRestartAttempts: 0,
  restartBackoffMs: 100,
  maxRestartBackoffMs: 5_000,
  maxOutputBytes: 64 * 1024,
  maxDiagnosticBytes: 2_048,
  gracefulSignal: 'SIGTERM',
  forcedSignal: 'SIGKILL',
});

export class ProcessSupervisorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessSupervisorError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}
const fail = (code, message) => { throw new ProcessSupervisorError(code, message); };

function assertData(value, label, seen = new Set(), depth = 0) {
  if (depth > 10) fail('INVALID_INPUT', `${label} exceeds validation depth`);
  const type = typeof value;
  if (value === null || type !== 'object') {
    if (['function', 'symbol', 'bigint', 'undefined'].includes(type)) fail('INVALID_INPUT', `${label} contains unsupported data`);
    return;
  }
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null && !Array.isArray(value)) fail('INVALID_INPUT', `${label} must be plain data`);
  seen.add(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !('value' in d)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    assertData(d.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function assertOperationOptions(options, label) {
  if (options == null) return;
  if (typeof options !== 'object' || Array.isArray(options)) fail('INVALID_INPUT', `${label} must be an object`);
  const keys = Object.getOwnPropertyNames(options);
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(options, key);
    if (!d || !('value' in d)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    if (key === 'signal') {
      const signal = d.value;
      if (signal != null && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function')) fail('INVALID_INPUT', `${label}.signal is not a valid AbortSignal`);
      continue;
    }
    if (key === 'deadlineMs') {
      if (d.value != null && (!Number.isSafeInteger(d.value) || d.value < 0)) fail('INVALID_INPUT', `${label}.deadlineMs is invalid`);
      continue;
    }
    assertData(d.value, `${label}.${key}`);
  }
}

function positive(value, fallback, label, zero = false) {
  const n = value ?? fallback;
  if (!Number.isSafeInteger(n) || (zero ? n < 0 : n <= 0)) fail('INVALID_INPUT', `${label} is invalid`);
  return n;
}

function normalize(options = {}) {
  assertData(options, 'options');
  if (typeof options.command !== 'string' || !options.command) fail('INVALID_INPUT', 'command is required');
  const args = options.args ?? [];
  if (!Array.isArray(args) || args.length > 256 || args.some((x) => typeof x !== 'string')) fail('INVALID_INPUT', 'args are invalid');
  if (options.cwd !== undefined && typeof options.cwd !== 'string') fail('INVALID_INPUT', 'cwd is invalid');
  if (options.env !== undefined && (options.env === null || typeof options.env !== 'object' || Array.isArray(options.env))) fail('INVALID_INPUT', 'env is invalid');
  const cfg = {
    command: options.command, args: [...args], cwd: options.cwd, env: options.env ? { ...options.env } : undefined,
    windowsHide: options.windowsHide !== false,
    stopGracePeriodMs: positive(options.stopGracePeriodMs, DEFAULTS.stopGracePeriodMs, 'stopGracePeriodMs'),
    maxRestartAttempts: positive(options.maxRestartAttempts, DEFAULTS.maxRestartAttempts, 'maxRestartAttempts', true),
    restartBackoffMs: positive(options.restartBackoffMs, DEFAULTS.restartBackoffMs, 'restartBackoffMs', true),
    maxRestartBackoffMs: positive(options.maxRestartBackoffMs, DEFAULTS.maxRestartBackoffMs, 'maxRestartBackoffMs', true),
    maxOutputBytes: positive(options.maxOutputBytes, DEFAULTS.maxOutputBytes, 'maxOutputBytes'),
    maxDiagnosticBytes: positive(options.maxDiagnosticBytes, DEFAULTS.maxDiagnosticBytes, 'maxDiagnosticBytes'),
    gracefulSignal: options.gracefulSignal ?? DEFAULTS.gracefulSignal,
    forcedSignal: options.forcedSignal ?? DEFAULTS.forcedSignal,
  };
  if (typeof cfg.gracefulSignal !== 'string' || typeof cfg.forcedSignal !== 'string' || cfg.gracefulSignal.length > 32 || cfg.forcedSignal.length > 32) fail('INVALID_INPUT', 'signal configuration is invalid');
  if (cfg.maxRestartBackoffMs < cfg.restartBackoffMs) fail('INVALID_INPUT', 'restart backoff bounds are invalid');
  return Object.freeze(cfg);
}

export function defaultCapabilities() {
  return Object.freeze({ spawn: nativeSpawn, now: () => Date.now(), identity: () => randomUUID(), setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (t) => clearTimeout(t) });
}
function assertCaps(c) { for (const k of ['spawn', 'now', 'identity', 'setTimer', 'clearTimer']) if (typeof c?.[k] !== 'function') fail('CAPABILITY_FAILURE', `${k} capability is required`); }

export function createProcessSupervisor(options, caps = defaultCapabilities()) {
  assertCaps(caps);
  const cfg = normalize(options);
  const supervisorId = caps.identity();
  if (typeof supervisorId !== 'string' || !supervisorId || supervisorId.length > 128) fail('CAPABILITY_FAILURE', 'invalid supervisor identity');
  const s = { state: 'idle', child: null, gen: 0, active: 0, attempt: 0, restartAttempts: 0, stopRequested: false, closed: false, queue: Promise.resolve(), restartTimer: null, stopTimer: null, stdoutBytes: 0, stderrBytes: 0, stdout: '', stderr: '', diagnostic: null, lastExit: null, stats: { starts: 0, stops: 0, restarts: 0, exits: 0, forcedKills: 0, spawnFailures: 0 } };
  const snap = () => Object.freeze({ supervisorId, state: s.state, generation: s.gen, activeGeneration: s.active || null, attempt: s.attempt, restartAttempts: s.restartAttempts, restartAttemptsRemaining: Math.max(0, cfg.maxRestartAttempts - s.restartAttempts), childPid: s.child?.pid ?? null, lastExit: s.lastExit ? Object.freeze({ ...s.lastExit }) : null, stdoutBytes: s.stdoutBytes, stderrBytes: s.stderrBytes, stdoutExcerpt: s.stdout, stderrExcerpt: s.stderr, lastDiagnostic: s.diagnostic, closed: s.closed, stats: Object.freeze({ ...s.stats }) });
  const queue = (fn) => { const p = s.queue.then(fn, fn); s.queue = p.catch(() => {}); return p; };
  const diag = (m) => { if (typeof m === 'string') s.diagnostic = m.slice(0, cfg.maxDiagnosticBytes); };
  const clear = (key) => { if (s[key]) { caps.clearTimer(s[key]); s[key] = null; } };
  const kill = (child, signal) => { if (!child || typeof child.kill !== 'function') fail('CAPABILITY_FAILURE', 'child kill capability missing'); try { child.kill(signal); } catch (e) { diag(e?.message); fail('CAPABILITY_FAILURE', 'child signal failed'); } };
  const record = (chunk, stream) => { const text = Buffer.from(chunk).toString('utf8'); const bytes = Buffer.byteLength(text); if (stream === 'stdout') { s.stdoutBytes += bytes; s.stdout = `${s.stdout}${text}`.slice(-cfg.maxOutputBytes); } else { s.stderrBytes += bytes; s.stderr = `${s.stderr}${text}`.slice(-cfg.maxOutputBytes); } const ok = s.stdoutBytes + s.stderrBytes <= cfg.maxOutputBytes; if (!ok) diag('process output exceeded configured bound'); return ok; };
  const delay = (ms) => new Promise((r) => { s.restartTimer = caps.setTimer(() => { s.restartTimer = null; r(); }, ms); });

  let startInternal;
  const attach = (child, gen, startup) => {
    let outputExceeded = false;
    const owned = () => s.child === child && s.active === gen;
    child.stdout?.on?.('data', (x) => { if (owned() && !record(x, 'stdout') && !outputExceeded) { outputExceeded = true; kill(child, cfg.gracefulSignal); } });
    child.stderr?.on?.('data', (x) => { if (owned() && !record(x, 'stderr') && !outputExceeded) { outputExceeded = true; kill(child, cfg.gracefulSignal); } });
    child.once?.('spawn', () => startup.resolve());
    child.once?.('error', (e) => { if (!owned()) return; s.stats.spawnFailures++; diag(e?.message); s.lastExit = { code: null, signal: null, reason: 'spawn-error' }; if (s.state === 'starting') startup.reject(new ProcessSupervisorError('SPAWN_FAILED', e?.message ?? 'child failed to spawn')); else { s.child = null; s.active = 0; s.state = 'failed'; } });
    child.once?.('close', (code, signal) => { if (!owned()) return; s.stats.exits++; s.lastExit = { code: Number.isInteger(code) ? code : null, signal: typeof signal === 'string' ? signal : null, reason: s.stopRequested ? 'requested-stop' : (outputExceeded ? 'output-limit' : 'exit') }; s.child = null; s.active = 0; if (s.closed || s.stopRequested) { s.state = s.closed ? 'closed' : 'idle'; return; } if (outputExceeded) { s.state = 'failed'; return; } if (cfg.maxRestartAttempts > 0 && s.restartAttempts < cfg.maxRestartAttempts) { s.state = 'restarting'; s.restartAttempts++; const backoff = Math.min(cfg.maxRestartBackoffMs, cfg.restartBackoffMs * 2 ** Math.max(0, s.restartAttempts - 1)); s.restartTimer = caps.setTimer(() => { s.restartTimer = null; queue(() => startInternal(true)).catch((e) => { s.state = 'failed'; diag(e?.message); }); }, backoff); } else s.state = code === 0 ? 'idle' : 'failed'; });
  };

  startInternal = async (automatic, deadlineMs, signal) => {
    if (s.closed) fail('SUPERVISOR_CLOSED', 'supervisor is closed');
    if (s.child) fail('BUSY', 'managed child is active');
    s.state = automatic ? 'restarting' : 'starting'; s.stopRequested = false; s.attempt++; s.stats.starts++; s.gen++; s.active = s.gen;
    const gen = s.gen;
    let child;
    try { child = caps.spawn(cfg.command, cfg.args, { cwd: cfg.cwd, env: cfg.env, shell: false, windowsHide: cfg.windowsHide, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { s.active = 0; s.state = 'failed'; diag(e?.message); fail('SPAWN_FAILED', e?.message ?? 'spawn failed'); }
    if (!child || typeof child.once !== 'function') fail('CAPABILITY_FAILURE', 'spawn capability returned invalid child');
    s.child = child;
    let resolveStart; let rejectStart;
    const startup = { resolve: () => resolveStart?.(), reject: (e) => rejectStart?.(e) };
    attach(child, gen, startup);
    const started = new Promise((resolve, reject) => { resolveStart = resolve; rejectStart = reject; });
    let deadlineTimer = null; let onAbort = null;
    if (deadlineMs != null) deadlineTimer = caps.setTimer(() => { if (s.child === child && s.active === gen) kill(child, cfg.forcedSignal); rejectStart?.(new ProcessSupervisorError('DEADLINE_EXCEEDED', 'child start exceeded deadline')); }, deadlineMs);
    if (signal) { onAbort = () => { if (s.child === child && s.active === gen) kill(child, cfg.forcedSignal); rejectStart?.(new ProcessSupervisorError('CANCELLED', 'start was cancelled')); }; signal.addEventListener('abort', onAbort, { once: true }); if (signal.aborted) onAbort(); }
    try { await started; s.state = 'running'; return snap(); }
    catch (e) { if (s.child === child && s.active === gen) { s.child = null; s.active = 0; s.state = 'failed'; } diag(e?.message); throw e; }
    finally { if (deadlineTimer) caps.clearTimer(deadlineTimer); if (onAbort) signal.removeEventListener('abort', onAbort); }
  };

  const stopInternal = async (deadlineMs, signal) => {
    if (s.closed) return snap();
    if (!s.child) { if (['running', 'starting', 'restarting'].includes(s.state)) s.state = 'idle'; return snap(); }
    const child = s.child; const gen = s.active; s.stopRequested = true; s.stats.stops++; s.state = 'stopping'; kill(child, cfg.gracefulSignal);
    return new Promise((resolve, reject) => {
      let settled = false; const finish = (e) => { if (settled) return; settled = true; clear('stopTimer'); s.stopRequested = false; e ? reject(e) : resolve(snap()); };
      child.once?.('close', () => finish());
      s.stopTimer = caps.setTimer(() => { if (settled || s.child !== child || s.active !== gen) return; s.stats.forcedKills++; kill(child, cfg.forcedSignal); s.stopTimer = caps.setTimer(() => finish(new ProcessSupervisorError('STOP_TIMEOUT', 'child did not terminate after forced escalation')), cfg.stopGracePeriodMs); }, cfg.stopGracePeriodMs);
      if (deadlineMs != null) caps.setTimer(() => { if (settled) return; kill(child, cfg.forcedSignal); finish(new ProcessSupervisorError('DEADLINE_EXCEEDED', 'stop exceeded deadline')); }, deadlineMs);
      if (signal) signal.addEventListener('abort', () => { if (settled) return; kill(child, cfg.forcedSignal); finish(new ProcessSupervisorError('CANCELLED', 'stop was cancelled')); }, { once: true });
    });
  };

  return Object.freeze({
    supervisorId, config: cfg, inspect: snap, snapshot: snap,
    start(options = {}) { assertOperationOptions(options, 'start.options'); if (options.signal?.aborted) return Promise.reject(new ProcessSupervisorError('CANCELLED', 'start was cancelled before execution')); return queue(() => startInternal(false, options.deadlineMs, options.signal)); },
    stop(options = {}) { assertOperationOptions(options, 'stop.options'); if (options.signal?.aborted) return Promise.reject(new ProcessSupervisorError('CANCELLED', 'stop was cancelled before execution')); return queue(() => stopInternal(options.deadlineMs, options.signal)); },
    restart(options = {}) { assertOperationOptions(options, 'restart.options'); if (s.closed) return Promise.reject(new ProcessSupervisorError('SUPERVISOR_CLOSED', 'supervisor is closed')); return queue(async () => { s.stats.restarts++; if (s.child) await stopInternal(options.deadlineMs, options.signal); s.restartAttempts++; if (cfg.maxRestartAttempts > 0 && s.restartAttempts > cfg.maxRestartAttempts) fail('RESTART_BUDGET_EXHAUSTED', 'restart budget exhausted'); if (cfg.restartBackoffMs) await delay(Math.min(cfg.maxRestartBackoffMs, cfg.restartBackoffMs * 2 ** Math.max(0, s.restartAttempts - 1))); return startInternal(false, options.deadlineMs, options.signal); }); },
    close: () => queue(async () => { if (s.closed) return snap(); s.closed = true; s.stopRequested = true; clear('restartTimer'); clear('stopTimer'); if (s.child) { try { kill(s.child, cfg.forcedSignal); } catch {} } s.child = null; s.active = 0; s.state = 'closed'; return snap(); }),
  });
}
