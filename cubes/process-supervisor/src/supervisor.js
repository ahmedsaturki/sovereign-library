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

const fail = (code, message, details = {}) => { throw new ProcessSupervisorError(code, message, details); };
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function assertData(value, label, seen = new Set(), depth = 0) {
  if (depth > 10) fail('INVALID_INPUT', `${label} exceeds validation depth`);
  const type = typeof value;
  if (value === null || type !== 'object') {
    if (['function', 'symbol', 'bigint', 'undefined'].includes(type)) fail('INVALID_INPUT', `${label} contains unsupported data`);
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

function positiveInt(value, fallback, label, allowZero = false) {
  const result = value ?? fallback;
  const valid = Number.isSafeInteger(result) && (allowZero ? result >= 0 : result > 0);
  if (!valid) fail('INVALID_INPUT', `${label} must be a ${allowZero ? 'non-negative' : 'positive'} safe integer`);
  return result;
}

function boundedString(value, limit, label) {
  if (typeof value !== 'string') fail('INVALID_INPUT', `${label} must be a string`);
  if (Buffer.byteLength(value, 'utf8') > limit) fail('INVALID_INPUT', `${label} exceeds bound`);
  return value;
}

function normalizeOptions(options = {}) {
  assertData(options, 'options');
  if (typeof options.command !== 'string' || options.command.length === 0) fail('INVALID_INPUT', 'command must be a non-empty string');
  const args = options.args ?? [];
  if (!Array.isArray(args) || args.length > 256 || args.some((value) => typeof value !== 'string')) fail('INVALID_INPUT', 'args must be a bounded array of strings');
  if (options.cwd !== undefined && typeof options.cwd !== 'string') fail('INVALID_INPUT', 'cwd must be a string');
  const env = options.env ?? undefined;
  if (env !== undefined && !isPlainObject(env)) fail('INVALID_INPUT', 'env must be a plain object');
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
  return Object.freeze(config);
}

export function defaultCapabilities() {
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

const canSignal = (child) => child && typeof child.kill === 'function';

export function createProcessSupervisor(options, capabilities = defaultCapabilities()) {
  assertCapabilities(capabilities);
  const config = normalizeOptions(options);
  const supervisorId = capabilities.identity();
  if (typeof supervisorId !== 'string' || supervisorId.length === 0 || supervisorId.length > 128) fail('CAPABILITY_FAILURE', 'identity capability returned invalid value');

  const state = {
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
    stopRequested: false,
    closed: false,
    queue: Promise.resolve(),
    restartTimer: null,
    stopTimer: null,
    deadlineTimer: null,
    stats: { starts: 0, stops: 0, restarts: 0, exits: 0, forcedKills: 0, spawnFailures: 0 },
  };

  const snapshot = () => Object.freeze({
    supervisorId,
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

  const enqueue = (operation) => {
    const next = state.queue.then(operation, operation);
    state.queue = next.catch(() => {});
    return next;
  };

  const setDiagnostic = (message) => {
    if (typeof message === 'string') state.lastDiagnostic = message.slice(0, config.maxDiagnosticBytes);
  };

  const appendOutput = (chunk, stream) => {
    const bytes = Buffer.byteLength(chunk, 'utf8');
    if (stream === 'stdout') {
      state.stdoutBytes += bytes;
      state.stdoutExcerpt = `${state.stdoutExcerpt}${chunk}`.slice(-config.maxOutputBytes);
    } else {
      state.stderrBytes += bytes;
      state.stderrExcerpt = `${state.stderrExcerpt}${chunk}`.slice(-config.maxOutputBytes);
    }
    const exceeded = state.stdoutBytes + state.stderrBytes > config.maxOutputBytes;
    if (exceeded) setDiagnostic('process output exceeded configured bound');
    return !exceeded;
  };

  const delay = (ms) => new Promise((resolve) => {
    const timer = capabilities.setTimer(() => { state.restartTimer = null; resolve(); }, ms);
    state.restartTimer = timer;
  });

  const clearTimer = (key) => {
    if (state[key]) {
      capabilities.clearTimer(state[key]);
      state[key] = null;
    }
  };

  const kill = (child, signal) => {
    if (!canSignal(child)) fail('CAPABILITY_FAILURE', 'child process lacks kill capability');
    try { child.kill(signal); } catch (error) {
      setDiagnostic(error?.message ?? 'failed to signal child');
      fail('CAPABILITY_FAILURE', 'failed to signal child');
    }
  };

  let startInternal;

  const wireChild = (child, generation, startup) => {
    let outputExceeded = false;
    const owned = () => state.child === child && state.activeGeneration === generation;

    child.stdout?.on?.('data', (chunk) => {
      if (!owned()) return;
      if (!appendOutput(Buffer.from(chunk).toString('utf8'), 'stdout') && !outputExceeded) {
        outputExceeded = true;
        kill(child, config.gracefulSignal);
      }
    });
    child.stderr?.on?.('data', (chunk) => {
      if (!owned()) return;
      if (!appendOutput(Buffer.from(chunk).toString('utf8'), 'stderr') && !outputExceeded) {
        outputExceeded = true;
        kill(child, config.gracefulSignal);
      }
    });

    child.once?.('error', (error) => {
      if (!owned()) return;
      state.stats.spawnFailures += 1;
      setDiagnostic(error?.message ?? 'child process error');
      state.lastExit = { code: null, signal: null, reason: 'spawn-error' };
      if (state.lifecycle === 'starting') {
        startup.reject(new ProcessSupervisorError('SPAWN_FAILED', error?.message ?? 'child failed to spawn'));
        return;
      }
      state.child = null;
      state.activeGeneration = 0;
      state.lifecycle = state.closed ? 'closed' : 'failed';
    });

    child.once?.('close', (code, signal) => {
      if (!owned()) return;
      state.stats.exits += 1;
      state.lastExit = { code: Number.isInteger(code) ? code : null, signal: typeof signal === 'string' ? signal : null, reason: state.stopRequested ? 'requested-stop' : (outputExceeded ? 'output-limit' : 'exit') };
      state.child = null;
      state.activeGeneration = 0;
      if (state.closed || state.stopRequested) {
        state.lifecycle = state.closed ? 'closed' : 'idle';
        return;
      }
      if (outputExceeded) {
        state.lifecycle = 'failed';
        return;
      }
      if (state.lifecycle === 'restarting') return;
      if (config.maxRestartAttempts > 0 && state.restartAttempts < config.maxRestartAttempts) {
        state.lifecycle = 'restarting';
        state.restartAttempts += 1;
        const backoff = Math.min(config.maxRestartBackoffMs, config.restartBackoffMs * 2 ** Math.max(0, state.restartAttempts - 1));
        state.restartTimer = capabilities.setTimer(() => {
          state.restartTimer = null;
          enqueue(() => startInternal(true)).catch((error) => { state.lifecycle = 'failed'; setDiagnostic(error.message); });
        }, backoff);
      } else {
        state.lifecycle = code === 0 ? 'idle' : 'failed';
      }
    });

    child.once?.('spawn', startup.resolve);
  };

  const startOne = async (automatic, deadlineMs, signal) => {
    if (state.closed) fail('SUPERVISOR_CLOSED', 'supervisor is closed');
    if (state.child) fail('BUSY', 'a managed child is already active');
    state.lifecycle = automatic ? 'restarting' : 'starting';
    state.stopRequested = false;
    state.attempt += 1;
    state.stats.starts += 1;
    state.generation += 1;
    const generation = state.generation;
    state.activeGeneration = generation;

    let startupResolve;
    let startupReject;
    const startup = {
      resolve: () => startupResolve?.(),
      reject: (error) => startupReject?.(error),
    };

    let child;
    try {
      child = capabilities.spawn(config.command, config.args, {
        cwd: config.cwd,
        env: config.env,
        shell: false,
        windowsHide: config.windowsHide,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      state.activeGeneration = 0;
      state.lifecycle = 'failed';
      setDiagnostic(error?.message ?? 'spawn failed');
      fail('SPAWN_FAILED', error?.message ?? 'child failed to spawn');
    }
    if (!child || typeof child.once !== 'function') fail('CAPABILITY_FAILURE', 'spawn capability returned invalid child');
    state.child = child;
    wireChild(child, generation, startup);

    let deadlineTimer = null;
    let abortHandler = null;
    const started = new Promise((resolve, reject) => {
      startupResolve = resolve;
      startupReject = reject;
      if (deadlineMs != null) {
        deadlineTimer = capabilities.setTimer(() => {
          if (state.child === child && state.activeGeneration === generation) {
            try { kill(child, config.forcedSignal); } catch {}
          }
          reject(new ProcessSupervisorError('DEADLINE_EXCEEDED', 'child start exceeded deadline'));
        }, deadlineMs);
      }
      if (signal) {
        abortHandler = () => {
          if (state.child === child && state.activeGeneration === generation) {
            try { kill(child, config.forcedSignal); } catch {}
          }
          reject(new ProcessSupervisorError('CANCELLED', 'start was cancelled'));
        };
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    });

    try {
      await started;
      state.lifecycle = 'running';
      return snapshot();
    } catch (error) {
      if (state.child === child && state.activeGeneration === generation) {
        state.child = null;
        state.activeGeneration = 0;
        state.lifecycle = 'failed';
      }
      setDiagnostic(error?.message ?? 'failed to start child');
      throw error;
    } finally {
      if (deadlineTimer) capabilities.clearTimer(deadlineTimer);
      if (abortHandler) signal?.removeEventListener('abort', abortHandler);
    }
  };

  startInternal = startOne;

  const stopOne = async (deadlineMs, signal) => {
    if (state.closed) return snapshot();
    if (!state.child) {
      if (['running', 'starting', 'restarting'].includes(state.lifecycle)) state.lifecycle = 'idle';
      return snapshot();
    }
    const child = state.child;
    const generation = state.activeGeneration;
    state.stopRequested = true;
    state.stats.stops += 1;
    state.lifecycle = 'stopping';
    kill(child, config.gracefulSignal);

    return new Promise((resolve, reject) => {
      let settled = false;
      let abortHandler = null;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimer('stopTimer');
        if (state.deadlineTimer) clearTimer('deadlineTimer');
        if (abortHandler) signal?.removeEventListener('abort', abortHandler);
        state.stopRequested = false;
        if (error) reject(error);
        else resolve(snapshot());
      };
      state.stopTimer = capabilities.setTimer(() => {
        if (settled || state.child !== child || state.activeGeneration !== generation) return;
        state.stats.forcedKills += 1;
        try { kill(child, config.forcedSignal); } catch (error) { finish(error); return; }
        state.stopTimer = capabilities.setTimer(() => finish(new ProcessSupervisorError('STOP_TIMEOUT', 'child did not terminate after forced escalation')), Math.max(1, config.stopGracePeriodMs));
      }, config.stopGracePeriodMs);
      child.once?.('close', () => finish());
      if (deadlineMs != null) {
        state.deadlineTimer = capabilities.setTimer(() => {
          if (settled) return;
          try { kill(child, config.forcedSignal); } catch (error) { finish(error); return; }
          finish(new ProcessSupervisorError('DEADLINE_EXCEEDED', 'stop exceeded deadline'));
        }, deadlineMs);
      }
      if (signal) {
        abortHandler = () => {
          if (settled) return;
          try { kill(child, config.forcedSignal); } catch (error) { finish(error); return; }
          finish(new ProcessSupervisorError('CANCELLED', 'stop was cancelled'));
        };
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    });
  };

  return Object.freeze({
    supervisorId,
    config,
    inspect: () => snapshot(),
    snapshot,
    start(options = {}) {
      assertData(options, 'start.options');
      if (options.signal?.aborted) return Promise.reject(new ProcessSupervisorError('CANCELLED', 'start was cancelled before execution'));
      return enqueue(() => startInternal(false, options.deadlineMs ?? null, options.signal));
    },
    stop(options = {}) {
      assertData(options, 'stop.options');
      if (options.signal?.aborted) return Promise.reject(new ProcessSupervisorError('CANCELLED', 'stop was cancelled before execution'));
      return enqueue(() => stopOne(options.deadlineMs ?? null, options.signal));
    },
    restart(options = {}) {
      assertData(options, 'restart.options');
      if (state.closed) return Promise.reject(new ProcessSupervisorError('SUPERVISOR_CLOSED', 'supervisor is closed'));
      if (options.signal?.aborted) return Promise.reject(new ProcessSupervisorError('CANCELLED', 'restart was cancelled before execution'));
      return enqueue(async () => {
        state.stats.restarts += 1;
        if (state.child) await stopOne(options.deadlineMs ?? null, options.signal);
        state.restartAttempts += 1;
        if (config.maxRestartAttempts > 0 && state.restartAttempts > config.maxRestartAttempts) fail('RESTART_BUDGET_EXHAUSTED', 'restart budget exhausted');
        if (config.restartBackoffMs > 0) await delay(Math.min(config.maxRestartBackoffMs, config.restartBackoffMs * 2 ** Math.max(0, state.restartAttempts - 1)));
        return startInternal(false, options.deadlineMs ?? null, options.signal);
      });
    },
    close: () => enqueue(async () => {
      if (state.closed) return snapshot();
      state.closed = true;
      state.stopRequested = true;
      clearTimer('restartTimer');
      clearTimer('stopTimer');
      clearTimer('deadlineTimer');
      if (state.child) {
        try { kill(state.child, config.forcedSignal); } catch {}
      }
      state.child = null;
      state.activeGeneration = 0;
      state.lifecycle = 'closed';
      return snapshot();
    }),
  });
}
