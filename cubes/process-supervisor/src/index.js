import { spawn as nativeSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const STATES = new Set(['idle', 'starting', 'running', 'stopping', 'restarting', 'failed', 'closed']);
const TRANSITIONS = new Map([
  ['idle', new Set(['starting', 'closed'])],
  ['starting', new Set(['running', 'failed', 'idle', 'stopping', 'closed'])],
  ['running', new Set(['stopping', 'restarting', 'failed', 'idle', 'closed'])],
  ['stopping', new Set(['idle', 'failed', 'closed'])],
  ['restarting', new Set(['starting', 'failed', 'idle', 'closed'])],
  ['failed', new Set(['starting', 'idle', 'closed'])],
  ['closed', new Set()],
]);

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

const fail = (code, message, details = {}) => { throw new ProcessSupervisorError(code, message, details); };
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function assertData(value, label, seen = new Set(), depth = 0) {
  if (depth > 10) fail('INVALID_INPUT', `${label} exceeds validation depth`);
  if (value === null || typeof value !== 'object') {
    if (['function', 'symbol', 'bigint', 'undefined'].includes(typeof value)) fail('INVALID_INPUT', `${label} contains unsupported data`);
    return;
  }
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) fail('INVALID_INPUT', `${label} must be plain data`);
  seen.add(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    assertData(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function boundedString(value, maxBytes, label) {
  if (value == null) return null;
  if (typeof value !== 'string') fail('INVALID_INPUT', `${label} must be a string`);
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes > maxBytes) fail('INVALID_INPUT', `${label} exceeds configured bound`);
  return value;
}

function positiveInt(value, fallback, label, allowZero = false) {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || (allowZero ? resolved < 0 : resolved <= 0)) fail('INVALID_INPUT', `${label} must be a ${allowZero ? 'non-negative' : 'positive'} safe integer`);
  return resolved;
}

function normalizeOptions(options = {}) {
  assertData(options, 'options');
  if (typeof options.command !== 'string' || options.command.length === 0) fail('INVALID_INPUT', 'command must be a non-empty string');
  const args = options.args ?? [];
  if (!Array.isArray(args) || args.some((value) => typeof value !== 'string')) fail('INVALID_INPUT', 'args must be an array of strings');
  if (args.length > 256) fail('INVALID_INPUT', 'args exceed configured bound');
  const env = options.env ?? undefined;
  if (env !== undefined && !isPlainObject(env)) fail('INVALID_INPUT', 'env must be an object');
  const config = {
    command: options.command,
    args: [...args],
    cwd: options.cwd,
    env: env ? { ...env } : undefined,
    windowsHide: options.windowsHide !== false,
    stopGracePeriodMs: positiveInt(options.stopGracePeriodMs, DEFAULTS.stopGracePeriodMs, 'stopGracePeriodMs'),
    maxRestartAttempts: positiveInt(options.maxRestartAttempts, DEFAULTS.maxRestartAttempts, 'maxRestartAttempts', true),
    restartBackoffMs: positiveInt(options.restartBackoffMs, DEFAULTS.restartBackoffMs, 'restartBackoffMs', true),
    maxRestartBackoffMs: positiveInt(options.maxRestartBackoffMs, DEFAULTS.maxRestartBackoffMs, 'maxRestartBackoffMs', true),
    maxOutputBytes: positiveInt(options.maxOutputBytes, DEFAULTS.maxOutputBytes, 'maxOutputBytes'),
    maxDiagnosticBytes: positiveInt(options.maxDiagnosticBytes, DEFAULTS.maxDiagnosticBytes, 'maxDiagnosticBytes'),
    gracefulSignal: boundedString(options.gracefulSignal ?? DEFAULTS.gracefulSignal, 32, 'gracefulSignal'),
    forcedSignal: boundedString(options.forcedSignal ?? DEFAULTS.forcedSignal, 32, 'forcedSignal'),
  };
  if (config.maxRestartBackoffMs < config.restartBackoffMs) fail('INVALID_INPUT', 'maxRestartBackoffMs must be >= restartBackoffMs');
  if (config.cwd !== undefined && typeof config.cwd !== 'string') fail('INVALID_INPUT', 'cwd must be a string');
  return Object.freeze(config);
}

function defaultCapabilities() {
  return Object.freeze({
    spawn: nativeSpawn,
    now: () => Date.now(),
    identity: () => randomUUID(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (timer) => clearTimeout(timer),
  });
}

function assertCapabilities(capabilities) {
  for (const key of ['spawn', 'now', 'identity', 'setTimer', 'clearTimer']) {
    if (typeof capabilities?.[key] !== 'function') fail('CAPABILITY_FAILURE', `${key} capability is required`);
  }
}

export function createProcessSupervisor(options, capabilities = defaultCapabilities()) {
  assertCapabilities(capabilities);
  const config = normalizeOptions(options);
  const supervisorId = capabilities.identity();
  if (typeof supervisorId !== 'string' || supervisorId.length === 0 || supervisorId.length > 128) fail('CAPABILITY_FAILURE', 'identity capability returned invalid value');

  const state = {
    supervisorId,
    lifecycle: 'idle',
    child: null,
    generation: 0,
    activeGeneration: 0,
    attempt: 0,
    restartAttempts: 0,
    lastExit: null,
    lastDiagnostic: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    stdoutExcerpt: '',
    stderrExcerpt: '',
    closed: false,
    queue: Promise.resolve(),
    stopRequested: false,
    automaticRestart: config.maxRestartAttempts > 0,
    stopTimer: null,
    restartTimer: null,
    deadlineTimer: null,
    stats: { starts: 0, stops: 0, restarts: 0, exits: 0, forcedKills: 0, spawnFailures: 0 },
  };

  const snapshot = () => Object.freeze({
    supervisorId: state.supervisorId,
    state: state.lifecycle,
    generation: state.generation,
    activeGeneration: state.activeGeneration || null,
    attempt: state.attempt,
    restartAttempts: state.restartAttempts,
    restartAttemptsRemaining: Math.max(0, config.maxRestartAttempts - state.restartAttempts),
    childPid: state.child?.pid ?? null,
    lastExit: state.lastExit ? Object.freeze({ ...state.lastExit }) : null,
    stdoutBytes: state.stdoutBytes,
    stderrBytes: state.stderrBytes,
    stdoutExcerpt: state.stdoutExcerpt,
    stderrExcerpt: state.stderrExcerpt,
    lastDiagnostic: state.lastDiagnostic,
    closed: state.closed,
    stats: Object.freeze({ ...state.stats }),
  });

  const transition = (next) => {
    if (!STATES.has(next) || !TRANSITIONS.get(state.lifecycle)?.has(next)) fail('INVALID_TRANSITION', `${state.lifecycle} -> ${next} is not allowed`);
    state.lifecycle = next;
  };

  const appendOutput = (chunk, stream) => {
    const bytes = Buffer.byteLength(chunk);
    if (stream === 'stdout') state.stdoutBytes += bytes;
    else state.stderrBytes += bytes;
    if (stream === 'stdout') state.stdoutExcerpt = `${state.stdoutExcerpt}${chunk}`.slice(-Math.max(1, config.maxOutputBytes));
    else state.stderrExcerpt = `${state.stderrExcerpt}${chunk}`.slice(-Math.max(1, config.maxOutputBytes));
    const total = state.stdoutBytes + state.stderrBytes;
    if (total > config.maxOutputBytes) {
      state.lastDiagnostic = 'process output exceeded configured bound';
      return false;
    }
    return true;
  };

  const setDiagnostic = (message) => {
    if (typeof message !== 'string') return;
    state.lastDiagnostic = message.slice(0, config.maxDiagnosticBytes);
  };

  const wait = (ms) => new Promise((resolve) => { const timer = capabilities.setTimer(resolve, ms); state.restartTimer = timer; });

  const enqueue = (operation) => {
    const next = state.queue.then(operation, operation);
    state.queue = next.catch(() => {});
    return next;
  };

  const invalidateGeneration = () => { state.activeGeneration = 0; };

  async function stopChild(force = false) {
    const child = state.child;
    if (!child) return;
    const generation = state.generation;
    if (generation !== state.activeGeneration) return;
    if (typeof child.kill !== 'function') fail('CAPABILITY_FAILURE', 'child process lacks kill capability');
    try {
      child.kill(force ? config.forcedSignal : config.gracefulSignal);
    } catch (error) {
      setDiagnostic(error?.message ?? 'failed to signal child');
      fail('CAPABILITY_FAILURE', 'failed to signal child');
    }
  }

  function wireChild(child, generation) {
    const owned = () => state.activeGeneration === generation && state.child === child;
    let terminatedByOutput = false;

    child.stdout?.on?.('data', (chunk) => {
      if (!owned()) return;
      const safe = appendOutput(Buffer.from(chunk).toString('utf8'), 'stdout');
      if (!safe && !terminatedByOutput) {
        terminatedByOutput = true;
        try { child.kill(config.gracefulSignal); } catch {}
      }
    });
    child.stderr?.on?.('data', (chunk) => {
      if (!owned()) return;
      const safe = appendOutput(Buffer.from(chunk).toString('utf8'), 'stderr');
      if (!safe && !terminatedByOutput) {
        terminatedByOutput = true;
        try { child.kill(config.gracefulSignal); } catch {}
      }
    });

    child.once?.('error', (error) => {
      if (!owned()) return;
      state.stats.spawnFailures += 1;
      setDiagnostic(error?.message ?? 'child process error');
      state.lastExit = { code: null, signal: null, reason: 'spawn-error' };
      state.child = null;
      invalidateGeneration();
      if (state.lifecycle === 'starting') state.lifecycle = 'failed';
    });

    child.once?.('close', (code, signal) => {
      if (!owned()) return;
      state.stats.exits += 1;
      state.lastExit = { code: Number.isInteger(code) ? code : null, signal: typeof signal === 'string' ? signal : null, reason: state.stopRequested ? 'requested-stop' : (terminatedByOutput ? 'output-limit' : 'exit') };
      state.child = null;
      state.activeGeneration = 0;
      if (state.stopRequested || state.closed) {
        if (state.lifecycle === 'stopping') state.lifecycle = state.closed ? 'closed' : 'idle';
        return;
      }
      if (terminatedByOutput) {
        state.lifecycle = 'failed';
        setDiagnostic('process output exceeded configured bound');
        return;
      }
      if (state.lifecycle === 'restarting') return;
      if (state.automaticRestart && state.restartAttempts < config.maxRestartAttempts) {
        state.lifecycle = 'restarting';
        state.restartAttempts += 1;
        const delay = Math.min(config.maxRestartBackoffMs, config.restartBackoffMs * 2 ** Math.max(0, state.restartAttempts - 1));
        state.restartTimer = capabilities.setTimer(() => { state.restartTimer = null; enqueue(() => startInternal(true)).catch(() => {}); }, delay);
      } else {
        state.lifecycle = code === 0 ? 'idle' : 'failed';
      }
    });
  }

  async function startInternal(isAutomatic = false, deadlineMs = null) {
    if (state.closed) fail('SUPERVISOR_CLOSED', 'supervisor is closed');
    if (state.child) fail('BUSY', 'a managed child is already active');
    if (!isAutomatic && (state.lifecycle === 'running' || state.lifecycle === 'starting' || state.lifecycle === 'stopping' || state.lifecycle === 'restarting')) fail('BUSY', 'supervisor is already active');
    if (!isAutomatic && state.lifecycle === 'failed') transition('starting');
    else if (state.lifecycle === 'idle' || state.lifecycle === 'restarting' || state.lifecycle === 'failed') state.lifecycle = 'starting';
    state.stopRequested = false;
    state.attempt += 1;
    state.stats.starts += 1;
    state.generation += 1;
    const generation = state.generation;
    state.activeGeneration = generation;
    const child = capabilities.spawn(config.command, config.args, {
      cwd: config.cwd,
      env: config.env,
      shell: false,
      windowsHide: config.windowsHide,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!child || typeof child.once !== 'function') fail('CAPABILITY_FAILURE', 'spawn capability returned invalid child');
    state.child = child;
    wireChild(child, generation);

    await new Promise((resolve, reject) => {
      let settled = false;
      const timer = deadlineMs == null ? null : capabilities.setTimer(() => {
        if (settled || !owned()) return;
        settled = true;
        try { child.kill(config.forcedSignal); } catch {}
        reject(new ProcessSupervisorError('DEADLINE_EXCEEDED', 'child start exceeded deadline'));
      }, deadlineMs);
      const owned = () => state.activeGeneration === generation && state.child === child;
      const onSpawn = () => {
        if (!owned() || settled) return;
        settled = true;
        if (timer) capabilities.clearTimer(timer);
        state.lifecycle = 'running';
        resolve();
      };
      const onError = (error) => {
        if (!owned() || settled) return;
        settled = true;
        if (timer) capabilities.clearTimer(timer);
        reject(new ProcessSupervisorError('SPAWN_FAILED', error?.message ?? 'child failed to spawn'));
      };
      child.once('spawn', onSpawn);
      child.once('error', onError);
    }).catch((error) => {
      if (state.activeGeneration === generation) {
        state.child = null;
        state.activeGeneration = 0;
        state.lifecycle = 'failed';
        setDiagnostic(error?.message ?? 'failed to start child');
      }
      throw error;
    });

    return snapshot();
  }

  async function stopInternal(deadlineMs = null) {
    if (!state.child) {
      if (state.lifecycle === 'running' || state.lifecycle === 'starting' || state.lifecycle === 'restarting') state.lifecycle = 'idle';
      return snapshot();
    }
    if (state.closed) return snapshot();
    state.stopRequested = true;
    state.stats.stops += 1;
    if (state.lifecycle !== 'stopping') state.lifecycle = 'stopping';
    const child = state.child;
    const generation = state.activeGeneration;
    await stopChild(false);
    await new Promise((resolve, reject) => {
      let settled = false;
      const effectiveGrace = deadlineMs == null ? config.stopGracePeriodMs : Math.min(config.stopGracePeriodMs, deadlineMs);
      const timer = capabilities.setTimer(() => {
        if (settled || state.activeGeneration !== generation || state.child !== child) return;
        try {
          state.stats.forcedKills += 1;
          child.kill(config.forcedSignal);
          state.stopTimer = null;
          const finalTimer = capabilities.setTimer(() => {
            if (settled || state.activeGeneration !== generation || state.child !== child) return;
            settled = true;
            state.stopTimer = null;
            reject(new ProcessSupervisorError('STOP_TIMEOUT', 'child did not terminate after forced escalation'));
          }, deadlineMs == null ? effectiveGrace : Math.max(1, deadlineMs));
          state.stopTimer = finalTimer;
        } catch (error) {
          settled = true;
          reject(new ProcessSupervisorError('CAPABILITY_FAILURE', error?.message ?? 'forced kill failed'));
        }
      }, effectiveGrace);
      state.stopTimer = timer;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (state.stopTimer) capabilities.clearTimer(state.stopTimer);
        state.stopTimer = null;
        resolve();
      };
      child.once('close', finish);
      if (deadlineMs != null) {
        state.deadlineTimer = capabilities.setTimer(() => {
          if (settled || state.activeGeneration !== generation || state.child !== child) return;
          settled = true;
          if (state.stopTimer) capabilities.clearTimer(state.stopTimer);
          try { child.kill(config.forcedSignal); } catch {}
          reject(new ProcessSupervisorError('DEADLINE_EXCEEDED', 'stop exceeded deadline'));
        }, deadlineMs);
      }
    });
    state.stopRequested = false;
    if (state.lifecycle !== 'closed') state.lifecycle = 'idle';
    return snapshot();
  }

  const supervisor = {
    supervisorId,
    config,
    snapshot,
    async start(options = {}) {
      assertData(options, 'start.options');
      if (options.signal?.aborted) fail('CANCELLED', 'start was cancelled before execution');
      return enqueue(() => startInternal(false, options.deadlineMs ?? null));
    },
    async stop(options = {}) {
      assertData(options, 'stop.options');
      if (state.closed) return snapshot();
      if (options.signal?.aborted) fail('CANCELLED', 'stop was cancelled before execution');
      return enqueue(() => stopInternal(options.deadlineMs ?? null));
    },
    async restart(options = {}) {
      assertData(options, 'restart.options');
      if (state.closed) fail('SUPERVISOR_CLOSED', 'supervisor is closed');
      if (options.signal?.aborted) fail('CANCELLED', 'restart was cancelled before execution');
      return enqueue(async () => {
        state.stats.restarts += 1;
        state.lifecycle = 'restarting';
        state.stopRequested = true;
        await stopInternal(options.deadlineMs ?? null);
        state.stopRequested = false;
        state.restartAttempts += 1;
        if (state.restartAttempts > config.maxRestartAttempts && config.maxRestartAttempts > 0) fail('RESTART_BUDGET_EXHAUSTED', 'restart budget exhausted');
        if (config.restartBackoffMs > 0) await wait(Math.min(config.maxRestartBackoffMs, config.restartBackoffMs * 2 ** Math.max(0, state.restartAttempts - 1)));
        return startInternal(false, options.deadlineMs ?? null);
      });
    },
    inspect() { return snapshot(); },
    async close() {
      if (state.closed) return snapshot();
      state.closed = true;
      state.stopRequested = true;
      if (state.restartTimer) capabilities.clearTimer(state.restartTimer);
      if (state.stopTimer) capabilities.clearTimer(state.stopTimer);
      if (state.deadlineTimer) capabilities.clearTimer(state.deadlineTimer);
      if (state.child) {
        try { state.child.kill(config.forcedSignal); } catch {}
      }
      state.activeGeneration = 0;
      state.child = null;
      state.lifecycle = 'closed';
      return snapshot();
    },
  };

  return Object.freeze(supervisor);
}

export { defaultCapabilities };
