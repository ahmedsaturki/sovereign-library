export class CacheCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'CacheCubeError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
  }
}

const DEFAULT_MAX_KEY_LENGTH = 512;
const DEFAULT_MAX_ENTRIES = 1000;

function assertKey(key, maxKeyLength) {
  if (typeof key !== 'string' || key.length === 0 || key.length > maxKeyLength) {
    throw new CacheCubeError('INVALID_KEY', `cache key must be a non-empty string <= ${maxKeyLength} characters`);
  }
}

function createClock(clock) {
  if (clock === undefined) return { now: () => Date.now() };
  if (!clock || typeof clock.now !== 'function') throw new CacheCubeError('INVALID_CLOCK', 'clock must provide now()');
  return clock;
}

function freezeMetadata(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.slice());
  return Object.freeze({ ...value });
}

export class Cache {
  constructor({ namespace = 'default', maxEntries = DEFAULT_MAX_ENTRIES, maxKeyLength = DEFAULT_MAX_KEY_LENGTH, clock } = {}) {
    if (typeof namespace !== 'string' || namespace.length === 0) throw new CacheCubeError('INVALID_NAMESPACE', 'namespace must be a non-empty string');
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new CacheCubeError('INVALID_MAX_ENTRIES', 'maxEntries must be a safe integer >= 1');
    if (!Number.isSafeInteger(maxKeyLength) || maxKeyLength < 1) throw new CacheCubeError('INVALID_MAX_KEY_LENGTH', 'maxKeyLength must be a safe integer >= 1');
    this.namespace = namespace;
    this.maxEntries = maxEntries;
    this.maxKeyLength = maxKeyLength;
    this.clock = createClock(clock);
    this.entries = new Map();
    this.inFlight = new Map();
    this.statsValue = { hits: 0, misses: 0, evictions: 0, sets: 0, deletes: 0 };
  }

  _fullKey(key) {
    assertKey(key, this.maxKeyLength);
    return `${this.namespace}:${key}`;
  }

  _expired(entry, now = this.clock.now()) {
    return entry.expiresAt !== undefined && now >= entry.expiresAt;
  }

  _touch(fullKey, entry) {
    this.entries.delete(fullKey);
    this.entries.set(fullKey, entry);
  }

  _removeExpired(fullKey, entry) {
    if (!this._expired(entry)) return false;
    this.entries.delete(fullKey);
    this.statsValue.deletes += 1;
    return true;
  }

  get(key) {
    const fullKey = this._fullKey(key);
    const entry = this.entries.get(fullKey);
    if (!entry || this._removeExpired(fullKey, entry)) {
      this.statsValue.misses += 1;
      return undefined;
    }
    this.statsValue.hits += 1;
    this._touch(fullKey, entry);
    return entry.value;
  }

  has(key) {
    const fullKey = this._fullKey(key);
    const entry = this.entries.get(fullKey);
    if (!entry || this._removeExpired(fullKey, entry)) return false;
    this._touch(fullKey, entry);
    return true;
  }

  set(key, value, { ttlMs } = {}) {
    const fullKey = this._fullKey(key);
    if (ttlMs !== undefined && (!Number.isSafeInteger(ttlMs) || ttlMs <= 0)) {
      throw new CacheCubeError('INVALID_TTL', 'ttlMs must be a safe integer > 0');
    }
    const now = this.clock.now();
    const entry = {
      value,
      createdAt: now,
      expiresAt: ttlMs === undefined ? undefined : now + ttlMs
    };
    if (this.entries.has(fullKey)) this.entries.delete(fullKey);
    this.entries.set(fullKey, entry);
    this.statsValue.sets += 1;
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
      this.statsValue.evictions += 1;
    }
    return value;
  }

  delete(key) {
    const fullKey = this._fullKey(key);
    const removed = this.entries.delete(fullKey);
    if (removed) this.statsValue.deletes += 1;
    return removed;
  }

  clear() {
    const count = this.entries.size;
    this.entries.clear();
    this.statsValue.deletes += count;
    return count;
  }

  invalidate(predicate) {
    if (typeof predicate !== 'function') throw new CacheCubeError('INVALID_PREDICATE', 'predicate must be a function');
    let count = 0;
    for (const [fullKey, entry] of this.entries) {
      const key = fullKey.slice(this.namespace.length + 1);
      if (predicate(key, entry.value)) {
        this.entries.delete(fullKey);
        count += 1;
      }
    }
    this.statsValue.deletes += count;
    return count;
  }

  getOrCompute(key, compute, options = {}) {
    const fullKey = this._fullKey(key);
    if (typeof compute !== 'function') throw new CacheCubeError('INVALID_COMPUTE', 'compute must be a function');

    const externalSignal = options.signal;
    if (externalSignal !== undefined && !(externalSignal instanceof AbortSignal)) {
      throw new CacheCubeError('INVALID_SIGNAL', 'signal must be an AbortSignal');
    }

    const cached = this.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    if (this.inFlight.has(fullKey)) return this.inFlight.get(fullKey).promise;

    const controller = new AbortController();
    const abort = () => controller.abort(externalSignal?.reason);
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort(externalSignal.reason);
      else externalSignal.addEventListener('abort', abort, { once: true });
    }

    const promise = (async () => {
      try {
        const value = await compute({ signal: controller.signal });
        if (controller.signal.aborted) throw new CacheCubeError('ABORTED', 'cache computation aborted');
        this.set(key, value, options);
        return value;
      } finally {
        this.inFlight.delete(fullKey);
        if (externalSignal) externalSignal.removeEventListener('abort', abort);
      }
    })();

    this.inFlight.set(fullKey, { promise, controller });
    return promise;
  }

  stats() {
    return freezeMetadata({ ...this.statsValue, size: this.entries.size, inFlight: this.inFlight.size });
  }

  snapshot() {
    return freezeMetadata({ namespace: this.namespace, size: this.entries.size, maxEntries: this.maxEntries, ...this.statsValue });
  }
}

export { DEFAULT_MAX_ENTRIES, DEFAULT_MAX_KEY_LENGTH };
