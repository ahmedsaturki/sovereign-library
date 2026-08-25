import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import { accessSync, constants as fsConstants } from 'node:fs';
import { EventEmitter } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const RUNNER_URL = new URL('./worker-runner.js', import.meta.url);
const DEFAULT_SIZE = 1;
const DEFAULT_MAX_QUEUE = 100;
const DEFAULT_TASK_TIMEOUT_MS = 30_000;

export class WorkerPoolError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'WorkerPoolError';
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    this.taskId = options.taskId ?? null;
    Object.freeze(this);
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new WorkerPoolError('INVALID_LIMIT', `${name} must be a safe integer >= 1`);
}

function normalizeWorkerModule(value) {
  let href;
  if (value instanceof URL) {
    href = value.href;
  } else if (typeof value === 'string') {
    href = value.startsWith('file://') ? value : pathToFileURL(resolve(value)).href;
  } else {
    throw new WorkerPoolError('INVALID_WORKER_MODULE', 'workerModule must be a file URL, URL, or filesystem path');
  }
  let url;
  try { url = new URL(href); } catch (cause) { throw new WorkerPoolError('INVALID_WORKER_MODULE', 'workerModule must be a valid file URL or filesystem path', { cause }); }
  if (url.protocol !== 'file:') throw new WorkerPoolError('INVALID_WORKER_MODULE', 'workerModule must use the file: protocol');
  try { accessSync(fileURLToPath(url), fsConstants.R_OK); } catch (cause) { throw new WorkerPoolError('INVALID_WORKER_MODULE', `workerModule is not readable: ${url.href}`, { cause }); }
  return url.href;
}

function serializeWorkerError(error) {
  const output = new Error(error?.message ?? String(error));
  output.name = error?.name ?? 'Error';
  if (error?.stack) output.stack = error.stack;
  if (error?.code !== undefined) output.code = error.code;
  return output;
}

export function createWorkerPool(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new WorkerPoolError('INVALID_OPTIONS', 'Worker pool options must be an object');
  const size = options.size ?? DEFAULT_SIZE;
  const maxQueue = options.maxQueue ?? DEFAULT_MAX_QUEUE;
  const taskTimeoutMs = options.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
  assertPositiveInteger(size, 'size');
  assertPositiveInteger(maxQueue, 'maxQueue');
  assertPositiveInteger(taskTimeoutMs, 'taskTimeoutMs');
  const moduleUrl = normalizeWorkerModule(options.workerModule);

  const workers = [];
  const queue = [];
  const pending = new Map();
  const events = new EventEmitter();
  let closed = false;
  let draining = false;
  let sequence = 0;

  function rejectQueued(error) {
    while (queue.length > 0) {
      const task = queue.shift();
      pending.delete(task.id);
      clearTimeout(task.timer);
      task.reject(error);
    }
  }

  async function closeWorkers(reason = new WorkerPoolError('POOL_CLOSED', 'Worker pool closed')) {
    if (closed) return;
    closed = true;
    draining = true;
    rejectQueued(reason);
    const active = workers.splice(0);
    for (const slot of active) {
      if (slot.task) {
        const task = slot.task;
        slot.task = null;
        slot.busy = false;
        pending.delete(task.id);
        clearTimeout(task.timer);
        task.reject(reason);
      }
    }
    await Promise.all(active.map(async slot => { try { await slot.worker.terminate(); } catch {} slot.stopped = true; }));
    for (const [id, task] of pending) {
      clearTimeout(task.timer);
      task.reject(new WorkerPoolError('POOL_CLOSED', 'Worker pool closed', { taskId: id }));
      pending.delete(id);
    }
  }

  async function terminateAndReplace(slot) {
    slot.stopped = true;
    const index = workers.indexOf(slot);
    if (index !== -1) workers.splice(index, 1);
    try { await slot.worker.terminate(); } catch {}
    if (!closed && !draining) {
      createWorkerSlot();
      pump();
    }
  }

  function createWorkerSlot() {
    const worker = new Worker(RUNNER_URL, { workerData: { moduleUrl } });
    const slot = { worker, busy: false, task: null, stopped: false };
    workers.push(slot);

    worker.on('message', message => {
      if (message?.type === 'boot-error') {
        const error = new WorkerPoolError('WORKER_BOOT_FAILED', message.error?.message ?? 'Worker failed to boot', { cause: message.error });
        events.emit('bootError', error);
        void closeWorkers(error);
        return;
      }
      if (!slot.task || message?.id !== slot.task.id) return;
      if (message.type === 'result') finishTask(slot, 'resolve', message.result);
      else if (message.type === 'error') finishTask(slot, 'reject', serializeWorkerError(message.error));
      pump();
    });

    worker.on('error', error => {
      slot.stopped = true;
      events.emit('workerError', error);
      if (slot.task) finishTask(slot, 'reject', new WorkerPoolError('WORKER_FAILED', 'Worker thread failed', { cause: error, taskId: slot.task.id }));
      void terminateAndReplace(slot);
    });

    worker.on('exit', code => {
      slot.stopped = true;
      if (code !== 0 && slot.task) finishTask(slot, 'reject', new WorkerPoolError('WORKER_EXITED', `Worker exited with code ${code}`, { taskId: slot.task.id }));
      if (!closed && !draining && workers.includes(slot)) void terminateAndReplace(slot);
    });

    return slot;
  }

  function finishTask(slot, mode, value) {
    const task = slot.task;
    if (!task) return;
    slot.task = null;
    slot.busy = false;
    pending.delete(task.id);
    clearTimeout(task.timer);
    if (mode === 'resolve') task.resolve(value);
    else task.reject(value);
    events.emit(mode === 'resolve' ? 'completed' : 'failed', { taskId: task.id, value });
  }

  function startTask(slot, task) {
    slot.busy = true;
    slot.task = task;
    task.timer = setTimeout(() => {
      if (!slot.task || slot.task.id !== task.id) return;
      const error = new WorkerPoolError('TASK_TIMEOUT', `Task exceeded ${taskTimeoutMs}ms`, { statusCode: 408, taskId: task.id });
      pending.delete(task.id);
      slot.task = null;
      slot.busy = false;
      task.reject(error);
      events.emit('timeout', { taskId: task.id });
      void terminateAndReplace(slot);
    }, taskTimeoutMs);
    slot.worker.postMessage({ type: 'run', id: task.id, payload: task.payload });
  }

  function cancelTask(task) {
    const queuedIndex = queue.findIndex(entry => entry.id === task.id);
    if (queuedIndex !== -1) {
      queue.splice(queuedIndex, 1);
      pending.delete(task.id);
      clearTimeout(task.timer);
      task.reject(new WorkerPoolError('CANCELLED', 'Task cancelled before execution', { statusCode: 499, taskId: task.id }));
      events.emit('cancelled', { taskId: task.id });
      return;
    }
    const slot = workers.find(entry => entry.task?.id === task.id);
    if (!slot) return;
    pending.delete(task.id);
    clearTimeout(task.timer);
    slot.task = null;
    slot.busy = false;
    task.reject(new WorkerPoolError('CANCELLED', 'Task cancelled during execution', { statusCode: 499, taskId: task.id }));
    events.emit('cancelled', { taskId: task.id });
    void terminateAndReplace(slot);
  }

  function pump() {
    if (closed) return;
    for (const slot of workers) {
      if (slot.stopped || slot.busy) continue;
      const task = queue.shift();
      if (!task) break;
      if (task.controller.signal.aborted) {
        pending.delete(task.id);
        clearTimeout(task.timer);
        task.reject(new WorkerPoolError('CANCELLED', 'Task cancelled before execution', { statusCode: 499, taskId: task.id }));
        continue;
      }
      startTask(slot, task);
    }
  }

  for (let index = 0; index < size; index += 1) createWorkerSlot();

  function submit(payload, options = {}) {
    if (closed || draining) return Promise.reject(new WorkerPoolError('POOL_CLOSED', 'Worker pool is not accepting new tasks'));
    if (queue.length >= maxQueue) return Promise.reject(new WorkerPoolError('QUEUE_FULL', `Worker pool queue is full at ${maxQueue}`, { statusCode: 429 }));
    const controller = new AbortController();
    const taskId = randomUUID();
    if (options.signal) {
      if (options.signal.aborted) return Promise.reject(new WorkerPoolError('CANCELLED', 'Task was already cancelled', { statusCode: 499, taskId }));
      options.signal.addEventListener('abort', () => controller.abort(options.signal.reason), { once: true });
    }
    return new Promise((resolvePromise, rejectPromise) => {
      const task = { id: taskId, payload, controller, resolve: resolvePromise, reject: rejectPromise, timer: null, sequence: sequence++ };
      pending.set(taskId, task);
      queue.push(task);
      controller.signal.addEventListener('abort', () => cancelTask(task), { once: true });
      pump();
    });
  }

  async function drain() {
    if (closed) return;
    draining = true;
    while (queue.length > 0 || [...workers].some(slot => slot.busy)) await new Promise(resolveWait => setTimeout(resolveWait, 1));
    await closeWorkers();
  }

  return Object.freeze({
    submit,
    drain,
    close: closeWorkers,
    on(event, listener) { events.on(event, listener); return () => events.off(event, listener); },
    stats() { return Object.freeze({ size, active: workers.filter(slot => slot.busy).length, queued: queue.length, pending: pending.size, closed, draining }); },
  });
}

export { DEFAULT_SIZE, DEFAULT_MAX_QUEUE, DEFAULT_TASK_TIMEOUT_MS };
