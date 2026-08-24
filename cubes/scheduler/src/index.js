import { randomUUID } from 'node:crypto';
import { defaultClock } from './clock.js';
import { PriorityHeap } from './heap.js';

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

export class SchedulerCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'SchedulerCubeError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
  }
}

function safeInteger(value, name, { min = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new SchedulerCubeError(`INVALID_${name.toUpperCase()}`, `${name} must be a safe integer >= ${min}`);
  }
}

function finiteNumber(value, code, message) {
  if (!Number.isFinite(value)) throw new SchedulerCubeError(code, message);
}

function normalizeBackoff(fn) {
  if (fn === undefined) return attempt => 100 * (2 ** Math.max(0, attempt - 1));
  if (typeof fn !== 'function') throw new SchedulerCubeError('INVALID_BACKOFF', 'retryBackoff must be a function');
  return attempt => {
    const delay = fn(attempt);
    safeInteger(delay, 'retryBackoff', { min: 0 });
    return delay;
  };
}

export class TaskScheduler {
  constructor({ concurrency = 1, maxQueueSize = Infinity, clock = defaultClock } = {}) {
    safeInteger(concurrency, 'concurrency', { min: 1 });
    if (maxQueueSize !== Infinity) safeInteger(maxQueueSize, 'maxQueueSize', { min: 0 });
    if (!clock || typeof clock.now !== 'function' || typeof clock.setTimeout !== 'function' || typeof clock.clearTimeout !== 'function') {
      throw new SchedulerCubeError('INVALID_CLOCK', 'clock must implement now, setTimeout and clearTimeout');
    }
    this.concurrency = concurrency;
    this.maxQueueSize = maxQueueSize;
    this.clock = clock;
    this.accepting = true;
    this.shuttingDown = false;
    this.running = 0;
    this.sequence = 0;
    this.tasks = new Map();
    this.idempotency = new Map();
    this.queue = new PriorityHeap((a, b) => a.priority - b.priority || a.sequence - b.sequence);
    this.delayed = new PriorityHeap((a, b) => a.runAt - b.runAt || a.sequence - b.sequence);
    this.timer = null;
    this.idleWaiters = new Set();
    this.completed = 0;
    this.failed = 0;
    this.cancelled = 0;
  }

  submit(fn, options = {}) {
    if (!this.accepting) throw new SchedulerCubeError('SHUTTING_DOWN', 'scheduler is not accepting new tasks');
    if (typeof fn !== 'function') throw new SchedulerCubeError('INVALID_FN', 'task function must be callable');
    const { priority = 0, delayMs = 0, retries = 0, timeoutMs, retryBackoff, idempotencyKey, signal } = options;
    finiteNumber(priority, 'INVALID_PRIORITY', 'priority must be finite');
    safeInteger(delayMs, 'delay', { min: 0 });
    safeInteger(retries, 'retries', { min: 0 });
    if (timeoutMs !== undefined) safeInteger(timeoutMs, 'timeout', { min: 1 });
    if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0)) {
      throw new SchedulerCubeError('INVALID_IDEMPOTENCY_KEY', 'idempotencyKey must be a non-empty string');
    }
    if (signal !== undefined && !(signal instanceof AbortSignal)) {
      throw new SchedulerCubeError('INVALID_SIGNAL', 'signal must be an AbortSignal');
    }
    const backoff = normalizeBackoff(retryBackoff);
    if (idempotencyKey && this.idempotency.has(idempotencyKey)) return this.idempotency.get(idempotencyKey);
    if (this.getQueueSize() >= this.maxQueueSize) throw new SchedulerCubeError('QUEUE_FULL', 'scheduler queue limit reached');

    const task = {
      id: randomUUID(), fn, priority, delayMs, retries, retryBackoff: backoff, timeoutMs,
      idempotencyKey, controller: new AbortController(), signal, sequence: this.sequence++, attempt: 0,
      status: delayMs > 0 ? 'delayed' : 'queued', createdAt: this.clock.now(), handle: null,
      resolve: null, outcome: null
    };
    task.handle = {
      id: task.id,
      get status() { return task.status; },
      get idempotencyKey() { return task.idempotencyKey; },
      promise: new Promise(resolve => { task.resolve = resolve; }),
      cancel: () => this.#cancel(task)
    };
    this.tasks.set(task.id, task);
    if (idempotencyKey) this.idempotency.set(idempotencyKey, task.handle);

    if (signal) {
      if (signal.aborted) this.#cancel(task);
      else {
        task.externalAbort = () => this.#cancel(task);
        signal.addEventListener('abort', task.externalAbort, { once: true });
      }
    }

    if (task.status === 'delayed') this.#scheduleDelayed(task, delayMs);
    else this.queue.push(task);
    this.#pump();
    return task.handle;
  }

  async drain() {
    this.accepting = false;
    if (this.getQueueSize() === 0 && this.running === 0) return;
    await new Promise(resolve => this.idleWaiters.add(resolve));
  }

  async shutdown() {
    if (this.shuttingDown) return;
    this.accepting = false;
    this.shuttingDown = true;
    if (this.timer !== null) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
    for (const task of [...this.queue.values()]) this.#cancel(task);
    for (const task of [...this.delayed.values()]) this.#cancel(task);
    for (const task of [...this.tasks.values()]) {
      if (task.status === 'running') this.#cancel(task);
    }
    this.#notifyIdle();
  }

  getTask(id) { return this.tasks.get(id)?.handle; }

  getStats() {
    return {
      queued: this.queue.size,
      delayed: this.delayed.size,
      running: this.running,
      completed: this.completed,
      failed: this.failed,
      cancelled: this.cancelled,
      concurrency: this.concurrency,
      utilization: this.running / this.concurrency
    };
  }

  getQueueSize() { return this.queue.size + this.delayed.size; }

  #scheduleDelayed(task, delayMs) {
    task.runAt = this.clock.now() + delayMs;
    this.delayed.push(task);
    this.#armTimer();
  }

  #armTimer() {
    if (this.timer !== null || this.delayed.size === 0 || this.shuttingDown) return;
    const next = this.delayed.peek();
    const delay = Math.max(0, next.runAt - this.clock.now());
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      this.#releaseDue();
      this.#armTimer();
    }, delay);
  }

  #releaseDue() {
    const now = this.clock.now();
    while (this.delayed.size > 0 && this.delayed.peek().runAt <= now) {
      const task = this.delayed.pop();
      if (task.status !== 'delayed' && task.status !== 'retrying') continue;
      task.status = 'queued';
      this.queue.push(task);
    }
    this.#pump();
  }

  #pump() {
    if (this.shuttingDown) {
      this.#notifyIdle();
      return;
    }
    while (this.running < this.concurrency && this.queue.size > 0) {
      const task = this.queue.pop();
      if (task.status !== 'queued') continue;
      this.#execute(task);
    }
    this.#notifyIdle();
  }

  async #execute(task) {
    task.status = 'running';
    task.attempt += 1;
    this.running += 1;
    const startedAt = this.clock.now();
    const controller = new AbortController();
    task.controller = controller;
    let timeout;
    const externalSignal = task.signal;
    const onExternalAbort = () => controller.abort();
    if (externalSignal) externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    if (task.timeoutMs !== undefined) timeout = this.clock.setTimeout(() => controller.abort('timeout'), task.timeoutMs);

    try {
      const value = await Promise.race([
        Promise.resolve().then(() => task.fn(controller.signal)),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new SchedulerCubeError(
          controller.signal.reason === 'timeout' ? 'TASK_TIMEOUT' : 'TASK_ABORTED',
          controller.signal.reason === 'timeout' ? 'task execution timed out' : 'task execution aborted',
          { retryable: true }
        )), { once: true }))
      ]);
      this.#complete(task, { ok: true, value, attempts: task.attempt, durationMs: this.clock.now() - startedAt });
    } catch (error) {
      if (task.status !== 'running') return;
      const timeoutError = error instanceof SchedulerCubeError && error.code === 'TASK_TIMEOUT';
      const aborted = error instanceof SchedulerCubeError && error.code === 'TASK_ABORTED';
      const canRetry = task.attempt <= task.retries && !aborted;
      if (canRetry) {
        task.status = 'retrying';
        const delay = task.retryBackoff(task.attempt);
        this.running -= 1;
        this.#scheduleDelayed(task, delay);
        this.#pump();
      } else if (aborted) {
        this.#complete(task, { ok: false, error, attempts: task.attempt, durationMs: this.clock.now() - startedAt });
      } else if (timeoutError) {
        this.#complete(task, { ok: false, error, attempts: task.attempt, durationMs: this.clock.now() - startedAt });
      } else {
        const wrapped = error instanceof Error ? error : new Error(String(error));
        this.#complete(task, { ok: false, error: new SchedulerCubeError('TASK_FAILED', wrapped.message, { cause: wrapped }), attempts: task.attempt, durationMs: this.clock.now() - startedAt });
      }
    } finally {
      if (timeout !== undefined) this.clock.clearTimeout(timeout);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  #complete(task, outcome) {
    if (TERMINAL.has(task.status)) return;
    this.running -= 1;
    task.outcome = outcome;
    task.status = outcome.ok ? 'completed' : (outcome.error.code === 'TASK_ABORTED' ? 'cancelled' : 'failed');
    if (task.status === 'completed') this.completed += 1;
    else if (task.status === 'cancelled') this.cancelled += 1;
    else this.failed += 1;
    if (task.externalAbort && task.signal) task.signal.removeEventListener('abort', task.externalAbort);
    if (task.idempotencyKey) this.idempotency.delete(task.idempotencyKey);
    task.resolve(outcome);
    this.#pump();
  }

  #cancel(task) {
    if (TERMINAL.has(task.status)) return false;
    if (task.status === 'queued') this.queue.remove(item => item.id === task.id);
    if (task.status === 'delayed' || task.status === 'retrying') this.delayed.remove(item => item.id === task.id);
    if (task.status === 'running') task.controller.abort('cancel');
    if (task.status !== 'running') {
      this.#complete(task, {
        ok: false,
        error: new SchedulerCubeError('TASK_CANCELLED', 'task was cancelled'),
        attempts: task.attempt,
        durationMs: this.clock.now() - task.createdAt
      });
    }
    return true;
  }

  #notifyIdle() {
    if (this.running !== 0 || this.queue.size !== 0 || this.delayed.size !== 0) return;
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters.clear();
  }
}

export { FakeClock, RealClock } from './clock.js';
export { PriorityHeap } from './heap.js';
