// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

/**
 * Browser Assertions Cube v0.1
 *
 * Assertion + snapshot layer for `browser-interactions`. Zero third-party
 * dependencies. Self-contained deterministic canonicalization (key-stable
 * serialization matching the Sovereign `canonical-json` contract) so the
 * package artifact is independently installable without access to the
 * monorepo source layout. Bounded retry respects each error's `retryable`
 * flag. Snapshot is an exact normalized HTML-string contract (Contract A).
 */

function canonicalStringify(value) {
  // Self-contained key-stable canonical serialization (matches the canonical-json
  // cube contract). Required for package independence: this package must not reach
  // into the monorepo (../../canonical-json) after it is published/installed.
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'number') return (Object.is(value, -0) ? '-0' : JSON.stringify(value));
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (t === 'object') {
    const entries = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k])}`);
    return `{${entries.join(',')}}`;
  }
  throw new AssertionsError('INVALID_SNAPSHOT', `cannot canonicalize value of type ${t}`, { retryable: false });
}

class CanonicalJsonError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CanonicalJsonError';
    Object.freeze(this);
  }
}

export class AssertionsError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'AssertionsError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    this.soft = Boolean(options.soft);
    Object.freeze(this);
  }
}

function fail(code, message, options) {
  throw new AssertionsError(code, message, options);
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_POLL_MS = 50;
const MAX_POLL_MS = 200;

function clampPoll(ms) {
  if (!Number.isSafeInteger(ms) || ms < 1) return DEFAULT_POLL_MS;
  return Math.min(ms, MAX_POLL_MS);
}

function validateTimeoutMs(ms) {
  if (
    !Number.isFinite(ms) ||
    !Number.isSafeInteger(ms) ||
    ms < 0 ||
    ms > 86_400_000 // hard cap: 24h
  ) {
    throw new AssertionsError('INVALID_TIMEOUT', `timeoutMs must be a finite integer in [0, 86400000], got ${String(ms)}`, { retryable: false });
  }
  return ms;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stableString(value) {
  // Delegate to the Sovereign canonical-json primitive for deterministic,
  // key-stable serialisation. This is an internal module dependency, not a
  // third-party runtime dependency.
  return canonicalStringify(value);
}

export class LocatorAssertions {
  constructor(locator, { timeoutMs = DEFAULT_TIMEOUT_MS, soft = false } = {}) {
    this.locator = locator;
    this.timeoutMs = validateTimeoutMs(timeoutMs);
    this.soft = soft;
  }

  async _retry(fn) {
    const deadline = Date.now() + this.timeoutMs;
    let last;
    let poll = DEFAULT_POLL_MS;
    while (true) {
      try {
        await fn();
        return;
      } catch (error) {
        last = error;
        // Unexpected (non-AssertionsError) errors from the locator/session are
        // NEITHER retryable NOR classification-guarded: a crashed session will
        // not heal by polling. Surface immediately (propagate the original error).
        if (!(error instanceof AssertionsError)) {
          if (this.soft) { this._softPush(error); return; }
          throw error;
        }
        // Non-retryable assertion/validation errors surface immediately
        // (e.g. INVALID_OPTION, NOT_HIDDEN, NOT_DISABLED, INVALID_TIMEOUT).
        if (!error.retryable) {
          if (this.soft) { this._softPush(error); return; }
          throw error;
        }
        if (Date.now() >= deadline) {
          if (this.soft) { this._softPush(error); return; }
          throw error;
        }
        const remaining = deadline - Date.now();
        await sleep(Math.min(poll, Math.max(0, remaining)));
        poll = clampPoll(poll * 1.5);
      }
    }
  }

  _softPush(error) {
    if (!this._softErrors) this._softErrors = [];
    this._softErrors.push(error);
  }

  /** v0.1 soft-assertion contract (Option B — minimal coherent API).
   *  Returns a frozen snapshot of collected soft failures, in deterministic
   *  insertion order. Empty array when none collected. No hidden global state. */
  softErrors() {
    return Object.freeze((this._softErrors || []).slice());
  }

  /** Clear collected soft failures (explicit lifecycle). */
  clearSoftErrors() {
    this._softErrors = [];
  }

  /** Whether any soft assertion failure was collected. */
  hasSoftErrors() {
    return (this._softErrors || []).length > 0;
  }

  _reject(code, message, retryable = false) {
    fail(code, message, { retryable, soft: this.soft });
  }

  async toBeVisible() {
    await this._retry(async () => {
      const visible = await this.locator.isVisible();
      if (!visible) this._reject('NOT_VISIBLE', 'Expected element to be visible', true);
    });
  }

  async toBeHidden() {
    await this._retry(async () => {
      const visible = await this.locator.isVisible();
      if (visible) this._reject('NOT_HIDDEN', 'Expected element to be hidden', false);
    });
  }

  async toBeEnabled() {
    await this._retry(async () => {
      const enabled = await this.locator.isEnabled();
      if (!enabled) this._reject('NOT_ENABLED', 'Expected element to be enabled', true);
    });
  }

  async toBeDisabled() {
    await this._retry(async () => {
      const enabled = await this.locator.isEnabled();
      if (enabled) this._reject('NOT_DISABLED', 'Expected element to be disabled', false);
    });
  }

  async toHaveText(expected) {
    await this._retry(async () => {
      const text = await this.locator.textContent();
      if (text !== expected) this._reject('TEXT_MISMATCH', `Expected text "${expected}" but got "${text}"`, true);
    });
  }

  async toHaveValue(expected) {
    await this._retry(async () => {
      const value = await this.locator.value();
      if (value !== expected) this._reject('VALUE_MISMATCH', `Expected value "${expected}" but got "${value}"`, true);
    });
  }

  async toHaveAttribute(name, expected) {
    if (typeof name !== 'string' || !name) fail('INVALID_OPTION', 'attribute name must be a non-empty string', { retryable: false });
    await this._retry(async () => {
      const actual = await this.locator.getAttribute(name);
      if (actual !== expected) this._reject('ATTRIBUTE_MISMATCH', `Expected attribute ${name}="${expected}" but got "${actual}"`, true);
    });
  }

  async toHaveCount(expected) {
    if (!Number.isSafeInteger(expected) || expected < 0) fail('INVALID_OPTION', 'count must be a non-negative integer', { retryable: false });
    await this._retry(async () => {
      const count = await this.locator.count();
      if (count !== expected) this._reject('COUNT_MISMATCH', `Expected ${expected} elements but found ${count}`, true);
    });
  }
}

// Snapshot Contract A: exact normalized HTML-string snapshot.
// - Source HTML is trimmed (leading/trailing whitespace is insignificant).
// - The canonical form is produced by the package's self-contained key-stable
//   canonicalizer (matching the canonical-json cube contract) so the package is
//   independently installable.
// - This is NOT structural DOM normalisation; it is exact HTML-text comparison
//   under whitespace-trim. The contract is documented in the SPEC.
export class Snapshot {
  constructor(domStringifier) {
    this._stringify = domStringifier || (html => html);
  }

  /** Produce a canonical, deterministic snapshot of an HTML string (Contract A). */
  capture(html) {
    if (typeof html !== 'string') fail('INVALID_SNAPSHOT', 'snapshot source must be a string', { retryable: false });
    const normalized = html.trim();
    const stable = canonicalStringify({ html: normalized });
    return Object.freeze({ html: normalized, stable, takenAt: 0 });
  }

  /** Compare two HTML snapshots for exact normalized equality (Contract A). */
  diff(before, after) {
    const a = typeof before === 'string' ? this.capture(before) : before;
    const b = typeof after === 'string' ? this.capture(after) : after;
    return Object.freeze({ equal: a.stable === b.stable, before: a, after: b });
  }
}

export function expect(locator, options = {}) {
  return new LocatorAssertions(locator, options);
}

export { DEFAULT_TIMEOUT_MS };
