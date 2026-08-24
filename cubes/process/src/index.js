import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

export class ProcessCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'ProcessCubeError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    this.cause = options.cause;
  }
}

function validateOptions(options) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new ProcessCubeError('INVALID_TIMEOUT', 'timeoutMs must be a positive safe integer');
  }
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    throw new ProcessCubeError('INVALID_OUTPUT_LIMIT', 'maxOutputBytes must be a positive safe integer');
  }
  if (options.args != null && (!Array.isArray(options.args) || options.args.some((value) => typeof value !== 'string'))) {
    throw new ProcessCubeError('INVALID_ARGS', 'args must be an array of strings');
  }
  if (options.env != null && (typeof options.env !== 'object' || Array.isArray(options.env))) {
    throw new ProcessCubeError('INVALID_ENV', 'env must be an object');
  }
  return { timeoutMs, maxOutputBytes };
}

export function run(command, options = {}) {
  if (typeof command !== 'string' || command.length === 0) {
    return Promise.reject(new ProcessCubeError('INVALID_COMMAND', 'command must be a non-empty string'));
  }

  let limits;
  try {
    limits = validateOptions(options);
  } catch (error) {
    return Promise.reject(error);
  }

  const args = options.args ?? [];
  const shell = options.shell === true;
  const cwd = options.cwd;
  const env = options.env ? { ...process.env, ...options.env } : process.env;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let outputExceeded = false;
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;

    const child = spawn(command, args, {
      cwd,
      env,
      shell,
      windowsHide: options.windowsHide ?? true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const finishError = (error) => {
      if (settled) return;
      settled = true;
      reject(error instanceof ProcessCubeError ? error : new ProcessCubeError('SPAWN_FAILED', error.message || 'Process failed to start', { cause: error }));
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill(options.killSignal ?? 'SIGTERM');
    }, limits.timeoutMs);

    const consume = (target, chunk, kind) => {
      if (settled) return;
      target.push(chunk);
      if (kind === 'stdout') stdoutBytes += chunk.length;
      else stderrBytes += chunk.length;
      if (stdoutBytes > limits.maxOutputBytes || stderrBytes > limits.maxOutputBytes) {
        outputExceeded = true;
        child.kill(options.killSignal ?? 'SIGTERM');
      }
    };

    child.stdout.on('data', (chunk) => consume(stdout, Buffer.from(chunk), 'stdout'));
    child.stderr.on('data', (chunk) => consume(stderr, Buffer.from(chunk), 'stderr'));
    child.on('error', finishError);

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (timedOut) {
        reject(new ProcessCubeError('TIMEOUT', `Process exceeded ${limits.timeoutMs}ms`, { retryable: true }));
        return;
      }
      if (outputExceeded) {
        reject(new ProcessCubeError('OUTPUT_TOO_LARGE', `Process output exceeded ${limits.maxOutputBytes} bytes`));
        return;
      }

      resolve({
        command,
        args,
        cwd: cwd ?? process.cwd(),
        code,
        signal,
        success: code === 0 && signal == null,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr)
      });
    });

    if (options.signal) {
      if (options.signal.aborted) {
        child.kill(options.killSignal ?? 'SIGTERM');
      } else {
        options.signal.addEventListener('abort', () => child.kill(options.killSignal ?? 'SIGTERM'), { once: true });
      }
    }
  });
}

export function text(value, encoding = 'utf8') {
  return Buffer.isBuffer(value) ? value.toString(encoding) : String(value ?? '');
}
