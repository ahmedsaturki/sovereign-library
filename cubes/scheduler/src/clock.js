export class RealClock {
  now() {
    return Date.now();
  }

  setTimeout(callback, delayMs) {
    return setTimeout(callback, delayMs);
  }

  clearTimeout(timer) {
    clearTimeout(timer);
  }
}

export class FakeClock {
  constructor(startMs = 0) {
    if (!Number.isSafeInteger(startMs) || startMs < 0) {
      throw new RangeError('FakeClock startMs must be a safe integer >= 0');
    }
    this.time = startMs;
    this.nextId = 1;
    this.timers = new Map();
  }

  now() {
    return this.time;
  }

  setTimeout(callback, delayMs) {
    if (!Number.isSafeInteger(delayMs) || delayMs < 0) {
      throw new RangeError('FakeClock delay must be a safe integer >= 0');
    }
    const id = this.nextId++;
    this.timers.set(id, { callback, runAt: this.time + delayMs });
    return id;
  }

  clearTimeout(id) {
    this.timers.delete(id);
  }

  advance(ms) {
    if (!Number.isSafeInteger(ms) || ms < 0) {
      throw new RangeError('FakeClock advance must be a safe integer >= 0');
    }
    this.time += ms;
    let progressed = true;
    while (progressed) {
      progressed = false;
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.runAt <= this.time)
        .sort((a, b) => a[1].runAt - b[1].runAt || a[0] - b[0]);
      for (const [id, timer] of due) {
        if (!this.timers.delete(id)) continue;
        timer.callback();
        progressed = true;
      }
    }
  }

  runAll() {
    while (this.timers.size > 0) {
      const next = Math.min(...[...this.timers.values()].map(timer => timer.runAt));
      this.advance(next - this.time);
    }
  }
}

export const defaultClock = new RealClock();
