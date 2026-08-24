const TERMINAL = Symbol('event-terminal');

export class EventCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'EventCubeError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
  }
}

function validateEventName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new EventCubeError('INVALID_EVENT_NAME', 'event name must be a non-empty string');
  }
}

function validateListener(listener) {
  if (typeof listener !== 'function') {
    throw new EventCubeError('INVALID_LISTENER', 'listener must be a function');
  }
}

function validateMaxListeners(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new EventCubeError('INVALID_MAX_LISTENERS', 'maxListeners must be a safe integer >= 0');
  }
}

function makeAggregate(errors) {
  if (errors.length === 1) return errors[0];
  return new AggregateError(errors, 'one or more event listeners failed');
}

export class EventBus {
  constructor({ maxListeners = 100 } = {}) {
    validateMaxListeners(maxListeners);
    this.maxListeners = maxListeners;
    this.listeners = new Map();
    this.closed = false;
    this.errorEvent = 'error';
  }

  on(event, listener, { once = false, signal } = {}) {
    if (this.closed) throw new EventCubeError('CLOSED', 'event bus is closed');
    validateEventName(event);
    validateListener(listener);
    if (once !== Boolean(once)) throw new EventCubeError('INVALID_ONCE', 'once must be boolean');
    if (signal !== undefined && !(signal instanceof AbortSignal)) {
      throw new EventCubeError('INVALID_SIGNAL', 'signal must be an AbortSignal');
    }
    const set = this.listeners.get(event) ?? new Set();
    if (this.maxListeners !== 0 && set.size >= this.maxListeners) {
      throw new EventCubeError('LISTENER_LIMIT', `listener limit reached for event: ${event}`);
    }

    const entry = { listener, once: Boolean(once), signal };
    set.add(entry);
    this.listeners.set(event, set);
    const off = () => {
      const current = this.listeners.get(event);
      if (!current) return false;
      const removed = current.delete(entry);
      if (current.size === 0) this.listeners.delete(event);
      if (signal && entry.abort) signal.removeEventListener('abort', entry.abort);
      return removed;
    };
    entry.off = off;
    if (signal) {
      if (signal.aborted) off();
      else {
        entry.abort = off;
        signal.addEventListener('abort', off, { once: true });
      }
    }
    return off;
  }

  once(event, listener, options = {}) {
    return this.on(event, listener, { ...options, once: true });
  }

  off(event, listener) {
    validateEventName(event);
    validateListener(listener);
    const set = this.listeners.get(event);
    if (!set) return false;
    for (const entry of set) {
      if (entry.listener === listener) return entry.off();
    }
    return false;
  }

  listenerCount(event) {
    validateEventName(event);
    return this.listeners.get(event)?.size ?? 0;
  }

  emit(event, payload) {
    if (this.closed) throw new EventCubeError('CLOSED', 'event bus is closed');
    validateEventName(event);
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return 0;
    const snapshot = [...set];
    const errors = [];
    let invoked = 0;
    for (const entry of snapshot) {
      if (!this.listeners.get(event)?.has(entry)) continue;
      invoked += 1;
      if (entry.once) entry.off();
      try {
        entry.listener(payload);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    if (errors.length) throw makeAggregate(errors);
    return invoked;
  }

  async emitAsync(event, payload) {
    if (this.closed) throw new EventCubeError('CLOSED', 'event bus is closed');
    validateEventName(event);
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return 0;
    const snapshot = [...set];
    const errors = [];
    let invoked = 0;
    for (const entry of snapshot) {
      if (!this.listeners.get(event)?.has(entry)) continue;
      invoked += 1;
      if (entry.once) entry.off();
      try {
        await entry.listener(payload);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    if (errors.length) throw makeAggregate(errors);
    return invoked;
  }

  waitFor(event, { signal, timeoutMs, filter } = {}) {
    validateEventName(event);
    if (signal !== undefined && !(signal instanceof AbortSignal)) {
      throw new EventCubeError('INVALID_SIGNAL', 'signal must be an AbortSignal');
    }
    if (timeoutMs !== undefined && (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)) {
      throw new EventCubeError('INVALID_TIMEOUT', 'timeoutMs must be a safe integer > 0');
    }
    if (filter !== undefined && typeof filter !== 'function') {
      throw new EventCubeError('INVALID_FILTER', 'filter must be a function');
    }
    return new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => {
        off();
        if (timer !== undefined) clearTimeout(timer);
      };
      const off = this.once(event, payload => {
        try {
          if (filter && !filter(payload)) {
            this.waitFor(event, { signal, timeoutMs, filter }).then(resolve, reject);
            return;
          }
          cleanup();
          resolve(payload);
        } catch (error) {
          cleanup();
          reject(error);
        }
      }, { signal });
      if (signal) {
        if (signal.aborted) {
          cleanup();
          reject(new EventCubeError('ABORTED', 'waitFor aborted'));
          return;
        }
        signal.addEventListener('abort', () => {
          cleanup();
          reject(new EventCubeError('ABORTED', 'waitFor aborted'));
        }, { once: true });
      }
      if (timeoutMs !== undefined) {
        timer = setTimeout(() => {
          cleanup();
          reject(new EventCubeError('TIMEOUT', 'waitFor timed out', { retryable: true }));
        }, timeoutMs);
      }
    });
  }

  close() {
    if (this.closed) return false;
    this.closed = true;
    for (const set of this.listeners.values()) {
      for (const entry of set) entry.off();
    }
    this.listeners.clear();
    return true;
  }
}

export const EVENT_TERMINAL = TERMINAL;
