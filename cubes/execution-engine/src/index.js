const DEFAULT_LIMITS = Object.freeze({
  maxTasks: 256,
  maxInputBytes: 65536,
  maxOutputBytes: 65536,
  maxDepth: 64,
  maxAttempts: 8,
  maxDiagnosticBytes: 4096,
});

class ExecutionError extends Error {
  constructor(code, message) { super(message); this.name = 'ExecutionError'; this.code = code; Object.freeze(this); }
}
const fail = (code, message) => { throw new ExecutionError(code, message); };
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const bytes = v => Buffer.byteLength(String(v), 'utf8');

function plain(value, label) {
  if (!isObj(value)) fail('INVALID_DEFINITION', `${label} must be an object`);
  for (const key of Object.keys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !('value' in d)) fail('INVALID_DEFINITION', `${label} contains accessor`);
  }
}

function limits(input = {}) {
  plain(input, 'limits');
  const out = Object.freeze({ ...DEFAULT_LIMITS, ...input });
  for (const [k, v] of Object.entries(out)) if (!Number.isSafeInteger(v) || v < 1) fail('INVALID_DEFINITION', `Invalid limit: ${k}`);
  return out;
}

function normalizeTask(task, lim) {
  plain(task, 'task');
  if (typeof task.id !== 'string' || !task.id) fail('INVALID_DEFINITION', 'Task id required');
  if (typeof task.run !== 'function') fail('INVALID_DEFINITION', `${task.id} requires run()`);
  const deps = task.dependsOn === undefined ? [] : task.dependsOn;
  if (!Array.isArray(deps) || deps.some(v => typeof v !== 'string')) fail('INVALID_DEFINITION', `${task.id} has invalid dependencies`);
  const maxRetries = task.maxRetries === undefined ? 0 : task.maxRetries;
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0 || maxRetries + 1 > lim.maxAttempts) fail('INVALID_DEFINITION', `${task.id} has invalid retry count`);
  const timeoutMs = task.timeoutMs === undefined ? 0 : task.timeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0) fail('INVALID_DEFINITION', `${task.id} has invalid timeout`);
  return Object.freeze({ id: task.id, dependsOn: Object.freeze([...deps].sort()), run: task.run, maxRetries, timeoutMs });
}

function validateGraph(tasks) {
  const map = new Map(tasks.map(t => [t.id, t]));
  const visiting = new Set(); const visited = new Set(); const depth = new Map();
  function dfs(id) {
    if (visiting.has(id)) fail('CYCLE_DETECTED', `Cycle detected at ${id}`);
    if (visited.has(id)) return depth.get(id) || 0;
    visiting.add(id);
    const task = map.get(id); if (!task) fail('INVALID_DEFINITION', `Unknown dependency: ${id}`);
    let d = 1;
    for (const dep of task.dependsOn) d = Math.max(d, dfs(dep) + 1);
    visiting.delete(id); visited.add(id); depth.set(id, d); return d;
  }
  for (const t of tasks) dfs(t.id);
  return Math.max(0, ...depth.values());
}

function immutableRecord(record) {
  const copy = structuredClone(record);
  return Object.freeze(copy);
}

function withTimeout(runOrPromise, timeoutMs) {
  const work = Promise.resolve().then(() => typeof runOrPromise === 'function' ? runOrPromise() : runOrPromise);
  if (!timeoutMs) return work.then(v => ({ kind: 'ok', value: v }), e => ({ kind: 'error', error: e }));
  return Promise.race([
    work.then(v => ({ kind: 'ok', value: v }), e => ({ kind: 'error', error: e })),
    new Promise(resolve => setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs)),
  ]);
}

function createExecutionEngine(definition = {}, options = {}) {
  plain(definition, 'definition'); plain(options, 'options');
  const lim = limits(options.limits ?? {});
  if (!Array.isArray(definition.tasks) || definition.tasks.length > lim.maxTasks) fail('INVALID_DEFINITION', 'Invalid task collection');
  const seen = new Set();
  const tasks = definition.tasks.map(t => {
    const nt = normalizeTask(t, lim);
    if (seen.has(nt.id)) fail('DUPLICATE_TASK', `Duplicate task: ${nt.id}`);
    seen.add(nt.id); return nt;
  });
  const maxDepth = validateGraph(tasks);
  if (maxDepth > lim.maxDepth) fail('LIMIT_EXCEEDED', 'Execution depth limit exceeded');
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  let cancelled = false;
  let latest = null;

  const initialStates = Object.fromEntries(tasks.map(t => [t.id, 'pending']));
  const initialAttempts = Object.fromEntries(tasks.map(t => [t.id, 0]));

  function cancel() { cancelled = true; }

  async function run({ input = undefined } = {}) {
    if (input !== undefined && bytes(JSON.stringify(input)) > lim.maxInputBytes) fail('LIMIT_EXCEEDED', 'Input exceeds limit');
    const results = {};
    const errors = {};
    const states = { ...initialStates };
    const attempts = { ...initialAttempts };
    const pending = new Set(tasks.map(t => t.id));
    const startedAt = Date.now();
    if (cancelled) {
      for (const id of pending) states[id] = 'cancelled';
      latest = immutableRecord({ status: 'cancelled', states, attempts, results, errors });
      return latest;
    }

    while (pending.size) {
      const ready = [...pending].filter(id => taskMap.get(id).dependsOn.every(dep => states[dep] === 'succeeded')).sort();
      const blocked = [...pending].filter(id => taskMap.get(id).dependsOn.some(dep => ['failed', 'timed_out', 'cancelled', 'skipped'].includes(states[dep]))).sort();
      for (const id of blocked) { states[id] = 'skipped'; pending.delete(id); }
      if (!ready.length) {
        if (pending.size) {
          if (cancelled) { for (const id of pending) states[id] = 'cancelled'; pending.clear(); break; }
          fail('EXECUTION_STALLED', 'Execution has no ready task');
        }
        break;
      }
      for (const id of ready) {
        if (cancelled) { states[id] = 'cancelled'; pending.delete(id); continue; }
        const task = taskMap.get(id);
        states[id] = 'running';
        let done = false;
        while (!done) {
          attempts[id] += 1;
          const ctx = Object.freeze({ input, results: Object.freeze({ ...results }), attempts: Object.freeze({ ...attempts }), signal: Object.freeze({ get cancelled() { return cancelled; } }) });
          const outcome = await withTimeout(() => task.run(ctx), task.timeoutMs);
          if (outcome.kind === 'ok') {
            if (outcome.value !== undefined && bytes(JSON.stringify(outcome.value)) > lim.maxOutputBytes) {
              outcome.kind = 'error'; outcome.error = new ExecutionError('LIMIT_EXCEEDED', `${id} output exceeds limit`);
            } else {
              results[id] = outcome.value; states[id] = 'succeeded'; pending.delete(id); done = true; continue;
            }
          }
          if (outcome.kind === 'timeout') errors[id] = { code: 'TASK_TIMEOUT', message: 'Task timed out' };
          else errors[id] = { code: outcome.error?.code || 'TASK_FAILED', message: 'Task failed' };
          if (attempts[id] <= task.maxRetries && !cancelled) {
            states[id] = 'pending'; continue;
          }
          states[id] = outcome.kind === 'timeout' ? 'timed_out' : (cancelled ? 'cancelled' : 'failed');
          pending.delete(id); done = true;
        }
      }
    }

    const status = cancelled ? 'cancelled' : Object.values(states).some(s => s === 'failed' || s === 'timed_out') ? 'failed' : 'succeeded';
    const record = { status, startedAt, finishedAt: Date.now(), states, attempts, results, errors };
    if (bytes(JSON.stringify(record)) > lim.maxDiagnosticBytes + lim.maxOutputBytes * 2) fail('LIMIT_EXCEEDED', 'Execution diagnostics exceed limit');
    latest = immutableRecord(record); return latest;
  }

  function snapshot() { return latest ? immutableRecord(latest) : immutableRecord({ status: 'idle', states: initialStates, attempts: initialAttempts, results: {}, errors: {} }); }

  return Object.freeze({ cancel, run, snapshot, taskIds: Object.freeze(tasks.map(t => t.id).sort()), limits: lim });
}

export { DEFAULT_LIMITS, ExecutionError, createExecutionEngine };
