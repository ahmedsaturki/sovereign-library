export class TimeoutError extends Error {
  constructor(message = 'Operation timed out', options = {}) {
    super(message, { cause: options.cause });
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT';
    this.deadlineAt = options.deadlineAt;
    this.elapsedMs = options.elapsedMs;
    Object.freeze(this);
  }
}

function assertSafeMs(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a safe integer >= 0`);
}

function assertClock(clock) {
  if (!clock || typeof clock.now !== 'function' || typeof clock.setTimer !== 'function' || typeof clock.clearTimer !== 'function') {
    throw new TypeError('clock must implement now(), setTimer(), and clearTimer()');
  }
}

export class RealClock {
  now() {
    if (typeof globalThis.performance?.now !== 'function') throw new Error('Monotonic performance clock is unavailable');
    return Math.floor(globalThis.performance.now());
  }

  setTimer(callback, delayMs) {
    assertSafeMs(delayMs, 'delayMs');
    return globalThis.setTimeout(callback, delayMs);
  }

  clearTimer(timer) {
    globalThis.clearTimeout(timer);
  }
}

export class FakeClock {
  constructor(startMs = 0) {
    assertSafeMs(startMs, 'startMs');
    this.time = startMs;
    this.nextTimerId = 1;
    this.timers = new Map();
  }

  now() {
    return this.time;
  }

  setTimer(callback, delayMs) {
    if (typeof callback !== 'function') throw new TypeError('callback must be a function');
    assertSafeMs(delayMs, 'delayMs');
    const id = this.nextTimerId++;
    this.timers.set(id, { id, dueAt: this.time + delayMs, callback });
    return id;
  }

  clearTimer(timer) {
    this.timers.delete(timer);
  }

  advance(ms) {
    assertSafeMs(ms, 'ms');
    const target = this.time + ms;
    while (true) {
      const due = [...this.timers.values()]
        .filter(timer => timer.dueAt <= target)
        .sort((a, b) => a.dueAt - b.dueAt || a.id - b.id)[0];
      if (!due) break;
      this.time = due.dueAt;
      this.timers.delete(due.id);
      due.callback();
    }
    this.time = target;
    return this.time;
  }
}

export class Deadline {
  constructor(deadlineAt, clock = new RealClock()) {
    assertSafeMs(deadlineAt, 'deadlineAt');
    assertClock(clock);
    this.deadlineAt = deadlineAt;
    this.clock = clock;
    Object.freeze(this);
  }

  remainingMs() {
    return Math.max(0, this.deadlineAt - this.clock.now());
  }

  isExpired() {
    return this.remainingMs() === 0;
  }

  snapshot() {
    return Object.freeze({
      deadlineAt: this.deadlineAt,
      remainingMs: this.remainingMs(),
      expired: this.isExpired(),
    });
  }

  child(durationMs) {
    assertSafeMs(durationMs, 'durationMs');
    return new Deadline(Math.min(this.deadlineAt, this.clock.now() + durationMs), this.clock);
  }
}

export function createDeadline(durationMs, options = {}) {
  assertSafeMs(durationMs, 'durationMs');
  const clock = options.clock ?? new RealClock();
  assertClock(clock);
  return new Deadline(clock.now() + durationMs, clock);
}

export function deadlineFromAbsolute(deadlineAt, options = {}) {
  const clock = options.clock ?? new RealClock();
  assertClock(clock);
  return new Deadline(deadlineAt, clock);
}

export async function withDeadline(operation, deadline, options = {}) {
  if (typeof operation !== 'function') throw new TypeError('operation must be a function');
  if (!(deadline instanceof Deadline)) throw new TypeError('deadline must be a Deadline');

  const parentSignal = options.signal ?? null;
  if (parentSignal?.aborted) throw parentSignal.reason ?? new DOMException('The operation was aborted', 'AbortError');

  const startedAt = deadline.clock.now();
  const remaining = deadline.remainingMs();
  if (remaining === 0) {
    throw new TimeoutError('Operation deadline already expired', {
      deadlineAt: deadline.deadlineAt,
      elapsedMs: 0,
    });
  }

  const controller = new AbortController();
  let timer = null;
  let removeParentAbort = null;
  let settled = false;
  const cleanup = () => {
    if (timer !== null) deadline.clock.clearTimer(timer);
    removeParentAbort?.();
  };
  const parentAbort = () => controller.abort(parentSignal.reason);

  if (parentSignal) {
    parentSignal.addEventListener('abort', parentAbort, { once: true });
    removeParentAbort = () => parentSignal.removeEventListener('abort', parentAbort);
  }

  try {
    const operationPromise = Promise.resolve().then(() => operation({ signal: controller.signal, deadline }));
    const timeoutPromise = new Promise((_, reject) => {
      timer = deadline.clock.setTimer(() => {
        if (settled) return;
        settled = true;
        const error = new TimeoutError('Operation timed out', {
          deadlineAt: deadline.deadlineAt,
          elapsedMs: Math.max(0, deadline.clock.now() - startedAt),
        });
        controller.abort(error);
        reject(error);
      }, remaining);
    });

    const result = await Promise.race([operationPromise, timeoutPromise]);
    settled = true;
    return result;
  } finally {
    cleanup();
  }
}

export function sleepUntil(deadline, options = {}) {
  return withDeadline(({ signal }) => new Promise((resolve, reject) => {
    const timer = deadline.clock.setTimer(resolve, deadline.remainingMs());
    const onAbort = () => {
      deadline.clock.clearTimer(timer);
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason ?? new DOMException('The operation was aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  }), deadline, options);
}
