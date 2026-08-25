export class BulkheadError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'BulkheadError';
    this.code = code;
    this.cancelled = options.cancelled === true;
    this.overflowed = options.overflowed === true;
    Object.freeze(this);
  }
}

function freezeSnapshot(value) {
  return Object.freeze({ ...value });
}

export class Lease {
  #released = false;
  constructor(bulkhead, id) {
    this.bulkhead = bulkhead;
    this.id = id;
    Object.freeze(this);
  }

  get released() { return this.#released; }

  release() {
    if (this.#released) throw new BulkheadError('DOUBLE_RELEASE', 'Lease has already been released');
    this.#released = true;
    this.bulkhead._release(this.id);
  }
}

export class Bulkhead {
  constructor(options = {}) {
    const { limit = 1, maxQueue = 0, clock = null } = options;
    if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError('limit must be a safe integer >= 1');
    if (!Number.isSafeInteger(maxQueue) || maxQueue < 0) throw new RangeError('maxQueue must be a safe integer >= 0');
    if (clock !== null && (!clock || typeof clock.now !== 'function')) throw new TypeError('clock must implement now()');
    this.limit = limit;
    this.maxQueue = maxQueue;
    this.clock = clock;
    this.active = 0;
    this.queue = [];
    this.closed = false;
    this.nextId = 1;
    this.stats = { granted: 0, queuedTotal: 0, rejected: 0, cancelled: 0, released: 0 };
  }

  tryAcquire() {
    if (this.closed) throw new BulkheadError('CLOSED', 'Bulkhead is closed');
    if (this.active >= this.limit) {
      this.stats.rejected += 1;
      return Object.freeze({ acquired: false });
    }
    const lease = this.#grant();
    return Object.freeze({ acquired: true, lease });
  }

  acquire(options = {}) {
    if (this.closed) return Promise.reject(new BulkheadError('CLOSED', 'Bulkhead is closed'));
    if (this.active < this.limit) return Promise.resolve(this.#grant());
    if (this.queue.length >= this.maxQueue) {
      this.stats.rejected += 1;
      return Promise.reject(new BulkheadError('QUEUE_FULL', 'Bulkhead queue is full', { overflowed: true }));
    }
    const { signal } = options;
    if (signal?.aborted) return Promise.reject(new BulkheadError('CANCELLED', 'Bulkhead acquisition cancelled', { cancelled: true, cause: signal.reason }));
    this.stats.queuedTotal += 1;
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, signal, removeAbort: null };
      if (signal) {
        const onAbort = () => {
          const index = this.queue.indexOf(entry);
          if (index >= 0) this.queue.splice(index, 1);
          this.stats.cancelled += 1;
          entry.removeAbort?.();
          reject(new BulkheadError('CANCELLED', 'Bulkhead acquisition cancelled', { cancelled: true, cause: signal.reason }));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        entry.removeAbort = () => signal.removeEventListener('abort', onAbort);
      }
      this.queue.push(entry);
    });
  }

  getStats() {
    return freezeSnapshot({
      limit: this.limit,
      active: this.active,
      queued: this.queue.length,
      queuedTotal: this.stats.queuedTotal,
      available: Math.max(0, this.limit - this.active),
      closed: this.closed,
      granted: this.stats.granted,
      rejected: this.stats.rejected,
      cancelled: this.stats.cancelled,
      released: this.stats.released,
    });
  }

  close(reason = new BulkheadError('CLOSED', 'Bulkhead closed')) {
    if (this.closed) return;
    this.closed = true;
    const pending = this.queue.splice(0);
    for (const entry of pending) {
      entry.removeAbort?.();
      entry.reject(reason);
    }
  }

  _release(id) {
    if (this.active <= 0) throw new BulkheadError('INVALID_RELEASE', `Lease ${id} is not active`);
    this.active -= 1;
    this.stats.released += 1;
    if (this.closed || this.queue.length === 0) return;
    const entry = this.queue.shift();
    entry.removeAbort?.();
    this.#grant(entry.resolve);
  }

  #grant(resolve) {
    this.active += 1;
    this.stats.granted += 1;
    const lease = new Lease(this, this.nextId++);
    if (resolve) resolve(lease);
    return lease;
  }
}
