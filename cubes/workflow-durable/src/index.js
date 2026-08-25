const DEFAULTS = Object.freeze({ maxSteps: 256, maxDepth: 16, maxFanOut: 32, maxHistoryEntries: 10000, maxPayloadBytes: 64 * 1024, maxHistoryBytes: 4 * 1024 * 1024, maxRetries: 8, maxTimeoutMs: 24 * 60 * 60 * 1000 });
const objectLike = (v) => v !== null && typeof v === 'object';
const bytes = (v) => Buffer.byteLength(v, 'utf8');

export class WorkflowError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'WorkflowError';
    this.code = code;
    this.stepId = options.stepId ?? null;
    this.executionId = options.executionId ?? null;
    Object.freeze(this);
  }
}

const fail = (code, message, options = {}) => { throw new WorkflowError(code, message, options); };
function rejectAccessors(value, path) {
  if (!objectLike(value)) return;
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_CONFIG', 'Accessor properties are not supported', { stepId: path });
  }
}
function freeze(value) {
  if (value === null || typeof value !== 'object') return value;
  rejectAccessors(value, 'config');
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  for (const key of Object.keys(value)) value[key] = freeze(value[key]);
  return Object.freeze(value);
}
function normalizeLimits(input = {}) {
  const limits = Object.freeze({ ...DEFAULTS, ...input });
  for (const [k, v] of Object.entries(limits)) if (!Number.isSafeInteger(v) || v < 1) fail('INVALID_CONFIG', `${k} must be a positive safe integer`);
  return limits;
}
function safeJsonSize(value) {
  try { return bytes(JSON.stringify(value)); } catch { return Infinity; }
}

export function createWorkflowEngine(config = {}) {
  if (!objectLike(config) || Array.isArray(config)) fail('INVALID_CONFIG', 'Engine configuration must be an object');
  rejectAccessors(config, 'config');
  const limits = normalizeLimits(config.limits ?? {});
  const workflows = new Map();
  let sequence = 0;

  function define(definition) {
    if (!objectLike(definition) || typeof definition.id !== 'string' || !definition.id) fail('INVALID_WORKFLOW', 'Workflow id is required');
    if (workflows.has(definition.id)) fail('INVALID_WORKFLOW', 'Workflow id already defined');
    if (!Array.isArray(definition.steps) || definition.steps.length > limits.maxSteps) fail('INVALID_WORKFLOW', 'Workflow step count exceeds limit');
    const ids = new Set();
    const validate = (steps, depth = 1) => {
      if (depth > limits.maxDepth) fail('INVALID_WORKFLOW', 'Workflow nesting exceeds limit');
      for (const step of steps) {
        if (!objectLike(step) || typeof step.id !== 'string' || !step.id) fail('INVALID_WORKFLOW', 'Step id is required');
        if (ids.has(step.id)) fail('DUPLICATE_STEP', 'Duplicate step id', { stepId: step.id });
        ids.add(step.id);
        if (!['task', 'parallel', 'if'].includes(step.kind)) fail('INVALID_WORKFLOW', 'Unsupported step kind', { stepId: step.id });
        if (step.kind === 'task' && typeof step.run !== 'function') fail('INVALID_WORKFLOW', 'Task step requires a run function', { stepId: step.id });
        if (step.kind === 'parallel') {
          if (!Array.isArray(step.steps) || step.steps.length > limits.maxFanOut) fail('INVALID_WORKFLOW', 'Parallel fan-out exceeds limit', { stepId: step.id });
          validate(step.steps, depth + 1);
        }
        if (step.kind === 'if') {
          if (typeof step.when !== 'function' || !Array.isArray(step.then) || !Array.isArray(step.else)) fail('INVALID_WORKFLOW', 'Conditional step requires when/then/else', { stepId: step.id });
          validate(step.then, depth + 1); validate(step.else, depth + 1);
        }
      }
    };
    validate(definition.steps);
    const frozen = freeze({ id: definition.id, version: definition.version ?? '1', steps: definition.steps });
    workflows.set(definition.id, frozen);
    return frozen;
  }

  function start(workflow, input = {}, options = {}) {
    if (!workflows.has(workflow.id)) fail('INVALID_WORKFLOW', 'Workflow is not registered');
    const executionId = options.executionId ?? `${workflow.id}:${++sequence}`;
    const history = [];
    const stepState = new Map();
    let state = 'PENDING';
    let canceled = false;
    let runningPromise = null;

    function append(entry) {
      const next = Object.freeze({ seq: history.length + 1, timestamp: Date.now(), ...entry });
      const size = safeJsonSize(next);
      if (history.length >= limits.maxHistoryEntries || size > limits.maxPayloadBytes || safeJsonSize(history) + size > limits.maxHistoryBytes) fail('HISTORY_LIMIT', 'Execution history exceeds configured limit', { executionId });
      history.push(next);
      return next;
    }

    const snapshot = () => Object.freeze({ executionId, workflowId: workflow.id, state, history: Object.freeze(history.slice()), steps: Object.freeze([...stepState.entries()].map(([id, s]) => Object.freeze({ id, ...s }))) });

    async function runStep(step, payload, path = []) {
      if (canceled) fail('CANCELED', 'Execution canceled', { executionId, stepId: step.id });
      const attempt = (stepState.get(step.id)?.attempt ?? 0) + 1;
      stepState.set(step.id, { state: 'RUNNING', attempt });
      append({ type: 'STEP_STARTED', stepId: step.id, attempt });
      try {
        let result;
        if (step.kind === 'task') {
          const controller = new AbortController();
          const timeoutMs = Math.min(step.timeoutMs ?? limits.maxTimeoutMs, limits.maxTimeoutMs);
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            result = await Promise.resolve(step.run(Object.freeze({ input: payload, signal: controller.signal, executionId, stepId: step.id, attempt, idempotencyKey: `${executionId}:${step.id}:${attempt}` })));
          } finally { clearTimeout(timer); }
          if (controller.signal.aborted) fail('STEP_TIMEOUT', 'Step timeout exceeded', { executionId, stepId: step.id });
        } else if (step.kind === 'parallel') {
          const results = await Promise.all(step.steps.map((child) => runStep(child, payload, [...path, step.id])));
          result = Object.freeze(results);
        } else {
          const branch = await Promise.resolve(step.when(Object.freeze({ input: payload, executionId, stepId: step.id })));
          result = await executeSteps(branch ? step.then : step.else, payload, [...path, step.id]);
          append({ type: 'BRANCH_SELECTED', stepId: step.id, attempt, branch: branch ? 'then' : 'else' });
        }
        stepState.set(step.id, { state: 'SUCCEEDED', attempt });
        append({ type: 'STEP_SUCCEEDED', stepId: step.id, attempt });
        return result;
      } catch (error) {
        if (error instanceof WorkflowError && error.code === 'STEP_TIMEOUT') append({ type: 'STEP_TIMEOUT', stepId: step.id, attempt });
        else append({ type: 'STEP_FAILED', stepId: step.id, attempt, code: error?.code ?? 'STEP_FAILURE' });
        if ((step.retries ?? 0) > 0 && attempt <= Math.min(step.retries, limits.maxRetries)) {
          append({ type: 'STEP_RETRY', stepId: step.id, attempt });
          await new Promise((resolve) => setTimeout(resolve, step.retryDelayMs ?? 0));
          return runStep(step, payload, path);
        }
        stepState.set(step.id, { state: error?.code === 'CANCELED' ? 'CANCELED' : 'FAILED', attempt });
        throw error instanceof WorkflowError ? error : new WorkflowError('STEP_FAILURE', 'Step failed', { cause: error, executionId, stepId: step.id });
      }
    }

    async function executeSteps(steps, payload, path = []) {
      const results = [];
      for (const step of steps) results.push(await runStep(step, payload, path));
      return Object.freeze(results);
    }

    async function run() {
      if (state === 'SUCCEEDED') return snapshot();
      if (runningPromise) return runningPromise;
      runningPromise = (async () => {
        state = 'RUNNING';
        append({ type: 'WORKFLOW_STARTED' });
        try {
          await executeSteps(workflow.steps, input);
          state = 'SUCCEEDED';
          append({ type: 'WORKFLOW_SUCCEEDED' });
        } catch (error) {
          state = error?.code === 'CANCELED' ? 'CANCELED' : 'FAILED';
          append({ type: state === 'CANCELED' ? 'WORKFLOW_CANCELED' : 'WORKFLOW_FAILED', code: error?.code ?? 'STEP_FAILURE' });
        }
        return snapshot();
      })();
      return runningPromise;
    }

    return Object.freeze({ executionId, run, cancel() { canceled = true; append({ type: 'WORKFLOW_CANCEL_REQUESTED' }); }, snapshot, history: () => Object.freeze(history.slice()) });
  }

  function replay(workflow, history) {
    if (!Array.isArray(history)) fail('REPLAY_FAILURE', 'History must be an array');
    const known = new Set();
    for (const entry of history) {
      if (!objectLike(entry) || !Number.isSafeInteger(entry.seq) || entry.seq !== known.size + 1) fail('REPLAY_FAILURE', 'History sequence is invalid');
      known.add(entry.seq);
    }
    const executionId = history[0]?.executionId ?? `replay:${workflow.id}`;
    return Object.freeze({ executionId, workflowId: workflow.id, state: history.some((e) => e.type === 'WORKFLOW_SUCCEEDED') ? 'SUCCEEDED' : 'RUNNING', history: Object.freeze(history.slice()) });
  }

  return Object.freeze({ define, start, replay, stats: () => Object.freeze({ workflows: workflows.size, sequence }) });
}
