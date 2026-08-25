import {RealClock} from './clock.js';

function assertPositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a finite number > 0`);
}

function snapshot(rateLimiter) {
  return Object.freeze({
    tokens: rateLimiter.tokens,
    capacity: rateLimiter.capacity,
    refillPerSecond: rateLimiter.refillPerSecond,
    queued: rateLimiter.queue.length,
    granted: rateLimiter.stats.granted,
    rejected: rateLimiter.stats.rejected,
    cancelled: rateLimiter.stats.cancelled,
    overflowed: rateLimiter.stats.overflowed,
    waited: rateLimiter.stats.waited,
  });
}

export class RateLimiter {
  constructor(options = {}) {
    const {capacity = 1, refillPerSecond = 1, maxQueue = 0, clock = new RealClock()} = options;
    assertPositiveNumber(capacity, 'capacity');
    assertPositiveNumber(refillPerSecond, 'refillPerSecond');
    if (!Number.isInteger(maxQueue) || maxQueue < 0) throw new RangeError('maxQueue must be an integer >= 0');
    if (!clock || typeof clock.now !== 'function' || typeof clock.setTimeout !== 'function' || typeof clock.clearTimeout !== 'function') {
      throw new TypeError('clock must implement now(), setTimeout(), clearTimeout()');
    }
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.maxQueue = maxQueue;
    this.clock = clock;
    this.tokens = capacity;
    this.lastRefillMs = clock.now();
    this.queue = [];
    this.timer = null;
    this.nextId = 1;
    this.stats = {granted: 0, rejected: 0, cancelled: 0, overflowed: 0, waited: 0};
  }

  _refill() {
    const now = this.clock.now();
    const elapsed = Math.max(0, now - this.lastRefillMs);
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + (elapsed / 1000) * this.refillPerSecond);
      this.lastRefillMs = now;
    }
  }

  _waitMsForOne() {
    if (this.tokens >= 1) return 0;
    return Math.max(1, Math.ceil(((1 - this.tokens) / this.refillPerSecond) * 1000));
  }

  _grantOne() {
    this._refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    this.stats.granted += 1;
    return true;
  }

  _schedule() {
    if (this.timer || this.queue.length === 0) return;
    const waitMs = this._waitMsForOne();
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      this._drain();
    }, waitMs);
  }

  _drain() {
    this._refill();
    while (this.queue.length > 0 && this.tokens >= 1) {
      const waiter = this.queue.shift();
      if (waiter.done) continue;
      if (waiter.signal?.aborted) {
        waiter.done = true;
        this.stats.cancelled += 1;
        waiter.reject(waiter.signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
        continue;
      }
      waiter.done = true;
      this.tokens -= 1;
      this.stats.granted += 1;
      this.stats.waited += 1;
      if (waiter.removeAbort) waiter.removeAbort();
      waiter.resolve(this._result(true, 0));
    }
    if (this.queue.length > 0) this._schedule();
  }

  _result(acquired, retryAfterMs) {
    return Object.freeze({acquired, retryAfterMs, queued: this.queue.length, remainingTokens: Math.max(0, this.tokens)});
  }

  tryAcquire() {
    this._refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.stats.granted += 1;
      return this._result(true, 0);
    }
    this.stats.rejected += 1;
    return this._result(false, this._waitMsForOne());
  }

  acquire(options = {}) {
    const {signal} = options;
    if (signal?.aborted) {
      this.stats.cancelled += 1;
      return Promise.reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
    }
    const immediate = this.tryAcquire();
    if (immediate.acquired) return Promise.resolve(immediate);
    if (this.queue.length >= this.maxQueue) {
      this.stats.overflowed += 1;
      return Promise.reject(new RangeError('rate limiter queue is full'));
    }

    return new Promise((resolve, reject) => {
      const waiter = {id: this.nextId++, resolve, reject, signal, done: false, removeAbort: null};
      if (signal) {
        const onAbort = () => {
          if (waiter.done) return;
          waiter.done = true;
          this.stats.cancelled += 1;
          const index = this.queue.indexOf(waiter);
          if (index >= 0) this.queue.splice(index, 1);
          reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
          this._schedule();
        };
        signal.addEventListener('abort', onAbort, {once: true});
        waiter.removeAbort = () => signal.removeEventListener('abort', onAbort);
      }
      this.queue.push(waiter);
      this._schedule();
    });
  }

  getStats() {
    this._refill();
    return snapshot(this);
  }

  clear(reason = new Error('rate limiter queue cleared')) {
    const pending = this.queue.splice(0);
    for (const waiter of pending) {
      if (waiter.done) continue;
      waiter.done = true;
      if (waiter.removeAbort) waiter.removeAbort();
      this.stats.cancelled += 1;
      waiter.reject(reason);
    }
  }

  close() {
    if (this.timer) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
    this.clear(new Error('rate limiter closed'));
  }
}
