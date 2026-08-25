import { spawn } from 'node:child_process';

const DEFAULT_LIMITS = Object.freeze({
  maxStages: 64,
  maxArgs: 32,
  maxOutputBytes: 32768,
  maxDiagnosticBytes: 8192,
  maxAttempts: 8,
});

class VerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VerificationError';
    this.code = code;
    Object.freeze(this);
  }
}

const fail = (code, message) => { throw new VerificationError(code, message); };

function plain(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_DEFINITION', `${label} must be an object`);
  for (const key of Object.keys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !('value' in d)) fail('INVALID_DEFINITION', `${label} contains accessor property`);
  }
}

function normalizeLimits(input = {}) {
  plain(input, 'limits');
  const out = Object.freeze({ ...DEFAULT_LIMITS, ...input });
  for (const [key, value] of Object.entries(out)) {
    if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_DEFINITION', `Invalid limit: ${key}`);
  }
  return out;
}

function normalizeCommand(command, limits) {
  if (typeof command !== 'string' || !command || /[\r\n;&|<>$`]/.test(command)) fail('INVALID_COMMAND', 'Unsafe executable');
  return command;
}

function normalizeStage(stage, limits) {
  plain(stage, 'stage');
  if (typeof stage.id !== 'string' || !stage.id) fail('INVALID_DEFINITION', 'Stage id is required');
  if (stage.args !== undefined && (!Array.isArray(stage.args) || stage.args.length > limits.maxArgs || stage.args.some(v => typeof v !== 'string'))) fail('INVALID_DEFINITION', `${stage.id} has invalid args`);
  const timeoutMs = stage.timeoutMs === undefined ? 0 : stage.timeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0) fail('INVALID_DEFINITION', `${stage.id} has invalid timeout`);
  const retries = stage.retries === undefined ? 0 : stage.retries;
  if (!Number.isSafeInteger(retries) || retries < 0 || retries + 1 > limits.maxAttempts) fail('INVALID_DEFINITION', `${stage.id} has invalid retries`);
  const env = stage.env === undefined ? {} : stage.env;
  plain(env, `${stage.id}.env`);
  for (const [key, value] of Object.entries(env)) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== 'string') fail('INVALID_DEFINITION', `${stage.id} has invalid environment`);
  return Object.freeze({
    id: stage.id,
    command: normalizeCommand(stage.command, limits),
    args: Object.freeze([...(stage.args ?? [])]),
    cwd: stage.cwd === undefined ? undefined : String(stage.cwd),
    env: Object.freeze({ ...env }),
    timeoutMs,
    retries,
    required: stage.required !== false,
  });
}

function immutable(value) {
  return Object.freeze(structuredClone(value));
}

function runCommand(stage, limits, signal) {
  return new Promise(resolve => {
    let settled = false;
    let outputBytes = 0;
    let stdout = '';
    let stderr = '';
    const child = spawn(stage.command, stage.args, { shell: false, cwd: stage.cwd, env: { ...process.env, ...stage.env }, windowsHide: true });
    let timer = null;
    const finish = value => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };
    const append = (kind, chunk) => {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > limits.maxOutputBytes) {
        child.kill();
        finish({ status: 'failed', code: 'OUTPUT_LIMIT', stdout, stderr });
        return;
      }
      if (kind === 'stdout') stdout += chunk;
      else stderr += chunk;
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => append('stdout', chunk));
    child.stderr.on('data', chunk => append('stderr', chunk));
    child.on('error', error => finish({ status: 'failed', code: error.code || 'SPAWN_FAILED', stdout, stderr }));
    child.on('close', code => finish({ status: code === 0 ? 'passed' : 'failed', code: code === 0 ? null : `EXIT_${code}`, stdout, stderr }));
    if (stage.timeoutMs) timer = setTimeout(() => { child.kill(); finish({ status: 'timed_out', code: 'TIMEOUT', stdout, stderr }); }, stage.timeoutMs);
    if (signal) {
      if (signal.aborted) { child.kill(); finish({ status: 'cancelled', code: 'CANCELLED', stdout, stderr }); }
      else signal.addEventListener('abort', () => { child.kill(); finish({ status: 'cancelled', code: 'CANCELLED', stdout, stderr }); }, { once: true });
    }
  });
}

function createVerificationHarness(definition = {}, options = {}) {
  plain(definition, 'definition');
  const limits = normalizeLimits(options.limits ?? {});
  if (!Array.isArray(definition.stages) || definition.stages.length > limits.maxStages) fail('INVALID_DEFINITION', 'Invalid stages');
  const seen = new Set();
  const stages = definition.stages.map(stage => {
    const normalized = normalizeStage(stage, limits);
    if (seen.has(normalized.id)) fail('DUPLICATE_STAGE', `Duplicate stage: ${normalized.id}`);
    seen.add(normalized.id);
    return normalized;
  });
  const ordered = Object.freeze([...stages].sort((a, b) => a.id.localeCompare(b.id)));
  let cancelled = false;
  let latest;
  const cancel = () => { cancelled = true; };

  async function run() {
    const results = {};
    for (const stage of ordered) {
      if (cancelled) { results[stage.id] = { status: 'cancelled', required: stage.required, attempts: 0 }; continue; }
      let final = null;
      for (let attempt = 1; attempt <= stage.retries + 1; attempt += 1) {
        const controller = new AbortController();
        if (cancelled) controller.abort();
        const outcome = await runCommand(stage, limits, controller.signal);
        final = { ...outcome, required: stage.required, attempts: attempt };
        if (outcome.status === 'passed' || outcome.status === 'cancelled') break;
      }
      results[stage.id] = final;
    }
    const requiredFailures = ordered.some(stage => stage.required && results[stage.id]?.status !== 'passed');
    latest = immutable({ verdict: requiredFailures ? 'failed' : 'passed', stages: results });
    return latest;
  }

  return Object.freeze({ run, cancel, snapshot: () => immutable(latest ?? { verdict: 'idle', stages: {} }), stages: ordered, limits });
}

export { DEFAULT_LIMITS, VerificationError, createVerificationHarness };
