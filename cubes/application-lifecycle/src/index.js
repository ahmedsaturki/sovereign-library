const STATES = new Set(['idle', 'running', 'stopping', 'stopped', 'failed', 'closed']);
const PARTICIPANT_OUTCOMES = new Set(['succeeded', 'failed', 'timed_out', 'cancelled', 'skipped_deadline']);
const DEFAULTS = Object.freeze({
  defaultTimeoutMs: 5_000,
  maxParticipants: 256,
  maxIdBytes: 128,
  maxMetadataBytes: 4 * 1024,
  maxDiagnosticBytes: 2 * 1024,
  maxOutcomeMessageBytes: 1 * 1024,
  globalShutdownTimeoutMs: 30_000,
  policy: 'continue',
});

export class ApplicationLifecycleError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ApplicationLifecycleError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const fail = (code, message, details = {}) => { throw new ApplicationLifecycleError(code, message, details); };
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function assertData(value, label, seen = new Set(), depth = 0) {
  if (depth > 12) fail('INVALID_INPUT', `${label} exceeds validation depth`);
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

function cloneData(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function bytes(value) { return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value), 'utf8'); }

function normalizeConfig(options = {}) {
  assertData(options, 'options');
  const config = {
    defaultTimeoutMs: options.defaultTimeoutMs ?? DEFAULTS.defaultTimeoutMs,
    maxParticipants: options.maxParticipants ?? DEFAULTS.maxParticipants,
    maxIdBytes: options.maxIdBytes ?? DEFAULTS.maxIdBytes,
    maxMetadataBytes: options.maxMetadataBytes ?? DEFAULTS.maxMetadataBytes,
    maxDiagnosticBytes: options.maxDiagnosticBytes ?? DEFAULTS.maxDiagnosticBytes,
    maxOutcomeMessageBytes: options.maxOutcomeMessageBytes ?? DEFAULTS.maxOutcomeMessageBytes,
    globalShutdownTimeoutMs: options.globalShutdownTimeoutMs ?? DEFAULTS.globalShutdownTimeoutMs,
    policy: options.policy ?? DEFAULTS.policy,
  };
  for (const [key, value] of Object.entries(config)) {
    if (key === 'policy') continue;
    if (!Number.isSafeInteger(value) || value <= 0) fail('INVALID_INPUT', `${key} must be a positive safe integer`);
  }
  if (!['continue', 'fail-fast'].includes(config.policy)) fail('INVALID_INPUT', 'policy must be continue or fail-fast');
  if (config.defaultTimeoutMs > config.globalShutdownTimeoutMs) fail('INVALID_INPUT', 'defaultTimeoutMs must not exceed globalShutdownTimeoutMs');
  return Object.freeze(config);
}

function normalizeRegistration(registration, config, sequence) {
  assertData(registration, 'participant');
  if (!isPlainObject(registration)) fail('INVALID_INPUT', 'participant must be an object');
  if (typeof registration.id !== 'string' || registration.id.length === 0) fail('INVALID_INPUT', 'participant id is required');
  if (bytes(registration.id) > config.maxIdBytes) fail('BOUNDS_EXCEEDED', 'participant id exceeds bound');
  const priority = registration.priority ?? 0;
  if (!Number.isSafeInteger(priority)) fail('INVALID_INPUT', 'participant priority must be a safe integer');
  const timeoutMs = registration.timeoutMs ?? config.defaultTimeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) fail('INVALID_INPUT', 'participant timeoutMs is invalid');
  const metadata = registration.metadata ?? {};
  if (!isPlainObject(metadata)) fail('INVALID_INPUT', 'participant metadata must be a plain object');
  if (bytes(metadata) > config.maxMetadataBytes) fail('BOUNDS_EXCEEDED', 'participant metadata exceeds bound');
  return Object.freeze({ id: registration.id, priority, timeoutMs, metadata: Object.freeze(cloneData(metadata)), sequence });
}

function defaultCapabilities() {
  return Object.freeze({
    now: () => Date.now(),
    identity: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (timer) => clearTimeout(timer),
  });
}

function assertCapabilities(capabilities) {
  for (const key of ['now', 'identity', 'setTimer', 'clearTimer']) {
    if (typeof capabilities?.[key] !== 'function') fail('CAPABILITY_FAILURE', `${key} capability is required`);
  }
}

export function createApplicationLifecycle(options = {}, capabilities = defaultCapabilities()) {
  assertCapabilities(capabilities);
  const config = normalizeConfig(options);
  const coordinatorId = capabilities.identity();
  if (typeof coordinatorId !== 'string' || coordinatorId.length === 0 || coordinatorId.length > 128) fail('CAPABILITY_FAILURE', 'identity capability returned invalid value');

  const participants = new Map();
  const state = {
    lifecycle: 'idle',
    shutdownPromise: null,
    shutdownId: null,
    startedAt: null,
    finishedAt: null,
    sequence: 0,
    lastDiagnostic: null,
    results: new Map(),
    timers: new Set(),
    closed: false,
  };

  const snapshot = () => {
    const results = [...state.results.values()].sort((a, b) => a.order - b.order).map((result) => Object.freeze({ ...result }));
    const successCount = results.filter((x) => x.outcome === 'succeeded').length;
    const failedCount = results.filter((x) => x.outcome === 'failed').length;
    const timedOutCount = results.filter((x) => x.outcome === 'timed_out').length;
    const cancelledCount = results.filter((x) => x.outcome === 'cancelled').length;
    const skippedCount = results.filter((x) => x.outcome === 'skipped_deadline').length;
    return Object.freeze({
      coordinatorId,
      state: state.lifecycle,
      shutdownId: state.shutdownId,
      participantCount: participants.size,
      completedCount: results.length,
      successCount,
      failedCount,
      timedOutCount,
      cancelledCount,
      skippedCount,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      remainingMs: state.startedAt == null ? null : Math.max(0, config.globalShutdownTimeoutMs - Math.max(0, capabilities.now() - state.startedAt)),
      participants: Object.freeze(results),
      lastDiagnostic: state.lastDiagnostic,
    });
  };

  const setDiagnostic = (message) => {
    if (typeof message === 'string') state.lastDiagnostic = message.slice(0, config.maxDiagnosticBytes);
  };

  const trackTimer = (timer) => {
    state.timers.add(timer);
    return timer;
  };

  const clearOwnedTimers = () => {
    for (const timer of state.timers) capabilities.clearTimer(timer);
    state.timers.clear();
  };

  const orderedParticipants = () => [...participants.values()].sort((a, b) => b.priority - a.priority || a.sequence - b.sequence || a.id.localeCompare(b.id));

  const invokeParticipant = async (participant, transactionId, remainingMs, signal) => {
    if (state.shutdownId !== transactionId) return;
    if (remainingMs <= 0) {
      state.results.set(participant.id, { id: participant.id, order: participant.sequence, outcome: 'skipped_deadline', durationMs: 0, message: 'global deadline exhausted' });
      return;
    }
    const started = capabilities.now();
    const timeoutMs = Math.min(participant.timeoutMs, remainingMs);
    let settled = false;
    let timeoutTimer = null;
    let abortHandler = null;
    try {
      const result = await new Promise((resolve) => {
        const finish = (outcome, message = null) => {
          if (settled) return;
          settled = true;
          if (timeoutTimer) capabilities.clearTimer(timeoutTimer);
          if (abortHandler) signal?.removeEventListener('abort', abortHandler);
          resolve({ outcome, message });
        };
        timeoutTimer = trackTimer(capabilities.setTimer(() => finish('timed_out', 'participant timeout'), timeoutMs));
        if (signal) {
          abortHandler = () => finish('cancelled', 'shutdown cancelled');
          signal.addEventListener('abort', abortHandler, { once: true });
          if (signal.aborted) abortHandler();
        }
        Promise.resolve()
          .then(() => participant.close())
          .then((value) => finish('succeeded', typeof value === 'string' ? value : null))
          .catch((error) => finish('failed', typeof error?.message === 'string' ? error.message : 'participant failure'));
      });
      if (state.shutdownId !== transactionId) return;
      const durationMs = Math.max(0, capabilities.now() - started);
      state.results.set(participant.id, { id: participant.id, order: participant.sequence, outcome: result.outcome, durationMs, message: result.message ? result.message.slice(0, config.maxOutcomeMessageBytes) : null });
      if (result.outcome === 'failed') setDiagnostic(`${participant.id}: ${result.message ?? 'participant failure'}`);
      if (result.outcome === 'timed_out') setDiagnostic(`${participant.id}: participant timeout`);
      return result.outcome;
    } finally {
      if (timeoutTimer) state.timers.delete(timeoutTimer);
    }
  };

  const shutdown = (options = {}) => {
    if (state.lifecycle === 'closed') return Promise.reject(new ApplicationLifecycleError('COORDINATOR_CLOSED', 'coordinator is closed'));
    if (state.shutdownPromise) return state.shutdownPromise;
    if (state.lifecycle === 'stopped') return Promise.resolve(snapshot());
    if (options != null) assertShutdownOptions(options);
    const signal = options?.signal;
    if (signal?.aborted) return Promise.reject(new ApplicationLifecycleError('CANCELLED', 'shutdown was cancelled before execution'));
    const transactionId = capabilities.identity();
    state.shutdownId = transactionId;
    state.lifecycle = 'stopping';
    state.startedAt = capabilities.now();
    state.finishedAt = null;
    state.results.clear();

    state.shutdownPromise = (async () => {
      const startTime = state.startedAt;
      const globalDeadline = startTime + (options?.timeoutMs ?? config.globalShutdownTimeoutMs);
      const ordered = orderedParticipants();
      let cancelled = false;
      let abortHandler = null;
      if (signal) {
        abortHandler = () => { cancelled = true; };
        signal.addEventListener('abort', abortHandler, { once: true });
      }
      try {
        for (const participant of ordered) {
          const remaining = globalDeadline - capabilities.now();
          if (cancelled || signal?.aborted) {
            state.results.set(participant.id, { id: participant.id, order: participant.sequence, outcome: 'cancelled', durationMs: 0, message: 'shutdown cancelled' });
            continue;
          }
          if (remaining <= 0) {
            state.results.set(participant.id, { id: participant.id, order: participant.sequence, outcome: 'skipped_deadline', durationMs: 0, message: 'global deadline exhausted' });
            continue;
          }
          const outcome = await invokeParticipant(participant, transactionId, remaining, signal);
          if (config.policy === 'fail-fast' && ['failed', 'timed_out', 'cancelled'].includes(outcome)) {
            for (const rest of ordered.slice(ordered.findIndex((x) => x.id === participant.id) + 1)) {
              state.results.set(rest.id, { id: rest.id, order: rest.sequence, outcome: 'skipped_deadline', durationMs: 0, message: 'fail-fast policy' });
            }
            break;
          }
        }
        const hasFailure = [...state.results.values()].some((x) => ['failed', 'timed_out'].includes(x.outcome));
        state.lifecycle = hasFailure ? 'failed' : (signal?.aborted ? 'stopped' : 'stopped');
        state.finishedAt = capabilities.now();
        return snapshot();
      } finally {
        if (abortHandler) signal?.removeEventListener('abort', abortHandler);
        state.shutdownPromise = null;
        clearOwnedTimers();
      }
    })();
    return state.shutdownPromise;
  };

  const register = (registration, capabilitiesForParticipant) => {
    if (state.closed) fail('COORDINATOR_CLOSED', 'coordinator is closed');
    if (state.lifecycle === 'stopping' || state.lifecycle === 'stopped' || state.lifecycle === 'failed') fail('INVALID_TRANSITION', 'participants cannot be registered after shutdown begins');
    if (participants.size >= config.maxParticipants) fail('BOUNDS_EXCEEDED', 'maximum participant count reached');
    const participant = normalizeRegistration(registration, config, ++state.sequence);
    if (participants.has(participant.id)) fail('DUPLICATE_PARTICIPANT', `participant ${participant.id} is already registered`);
    if (!capabilitiesForParticipant || typeof capabilitiesForParticipant.close !== 'function') fail('CAPABILITY_FAILURE', 'participant close capability is required');
    participants.set(participant.id, Object.freeze({ ...participant, close: capabilitiesForParticipant.close }));
    return Object.freeze({ id: participant.id, priority: participant.priority, timeoutMs: participant.timeoutMs, metadata: Object.freeze(cloneData(participant.metadata)) });
  };

  const unregister = (id) => {
    if (state.closed) fail('COORDINATOR_CLOSED', 'coordinator is closed');
    if (state.lifecycle !== 'idle' && state.lifecycle !== 'running') fail('INVALID_TRANSITION', 'participants may only be unregistered before shutdown');
    if (typeof id !== 'string' || !participants.delete(id)) fail('INVALID_INPUT', 'unknown participant id');
    return snapshot();
  };

  const start = () => {
    if (state.closed) fail('COORDINATOR_CLOSED', 'coordinator is closed');
    if (state.lifecycle === 'idle') state.lifecycle = 'running';
    if (state.lifecycle !== 'running') fail('INVALID_TRANSITION', `cannot start from ${state.lifecycle}`);
    return snapshot();
  };

  const close = () => {
    if (state.closed) return snapshot();
    if (state.shutdownPromise) fail('COORDINATOR_BUSY', 'cannot close during active shutdown');
    state.closed = true;
    state.lifecycle = 'closed';
    clearOwnedTimers();
    return snapshot();
  };

  const coordinator = {
    coordinatorId,
    config,
    register,
    unregister,
    start,
    shutdown,
    inspect: snapshot,
    snapshot,
    close,
  };
  return Object.freeze(coordinator);
}

function assertShutdownOptions(options) {
  if (typeof options !== 'object' || Array.isArray(options)) fail('INVALID_INPUT', 'shutdown options must be an object');
  for (const key of Object.getOwnPropertyNames(options)) {
    const d = Object.getOwnPropertyDescriptor(options, key);
    if (!d || !('value' in d)) fail('ACCESSOR_INPUT', `shutdown.options.${key} is accessor-backed`);
    if (key === 'signal') {
      if (d.value != null && (typeof d.value.aborted !== 'boolean' || typeof d.value.addEventListener !== 'function' || typeof d.value.removeEventListener !== 'function')) fail('INVALID_INPUT', 'shutdown signal is invalid');
      continue;
    }
    if (key === 'timeoutMs') {
      if (d.value != null && (!Number.isSafeInteger(d.value) || d.value <= 0)) fail('INVALID_INPUT', 'shutdown timeoutMs is invalid');
      continue;
    }
    assertData(d.value, `shutdown.options.${key}`);
  }
}

export { defaultCapabilities };
