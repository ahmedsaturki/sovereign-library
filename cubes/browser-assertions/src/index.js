// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

/**
 * Browser Assertions Cube v0.1
 *
 * Assertion + snapshot layer for `browser-interactions`. Zero third-party
 * dependencies. Built for determinism: every assertion is retryable within a
 * bounded deadline and returns a stable, classified error on failure.
 */

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function deepStableEqual(a, b) {
  // Stable equality: strings compared directly; objects compared via
  // canonical-json-style key-sorted serialization to avoid key-order flakiness.
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'string') return a === b;
  const sa = stableString(a);
  const sb = stableString(b);
  return sa === sb;
}

function stableString(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableString).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableString(value[k])).join(',') + '}';
}

export class LocatorAssertions {
  constructor(locator, { timeoutMs = DEFAULT_TIMEOUT_MS, soft = false } = {}) {
    this.locator = locator;
    this.timeoutMs = timeoutMs;
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
        if (Date.now() >= deadline) {
          if (this.soft) { this._softPush(error); return; }
          throw error;
        }
        await sleep(poll);
        poll = clampPoll(poll * 1.5);
      }
    }
  }

  _softPush(error) {
    if (!this._softErrors) this._softErrors = [];
    this._softErrors.push(error);
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
    if (typeof name !== 'string' || !name) fail('INVALID_OPTION', 'attribute name must be a non-empty string');
    await this._retry(async () => {
      const actual = await this.locator.getAttribute(name);
      if (actual !== expected) this._reject('ATTRIBUTE_MISMATCH', `Expected attribute ${name}="${expected}" but got "${actual}"`, true);
    });
  }

  async toHaveCount(expected) {
    if (!Number.isSafeInteger(expected) || expected < 0) fail('INVALID_OPTION', 'count must be a non-negative integer');
    await this._retry(async () => {
      const count = await this.locator.count();
      if (count !== expected) this._reject('COUNT_MISMATCH', `Expected ${expected} elements but found ${count}`, true);
    });
  }
}

export class Snapshot {
  constructor(domStringifier) {
    this._stringify = domStringifier || (html => html);
  }

  /** Produce a canonical, key-stable snapshot of a DOM subtree string. */
  capture(html) {
    if (typeof html !== 'string') fail('INVALID_SNAPSHOT', 'snapshot source must be a string');
    const stable = stableString({ html: html.trim() });
    return Object.freeze({ html: html.trim(), stable, takenAt: 0 });
  }

  /** Compare two HTML snapshots with structural (key-stable) equality. */
  diff(before, after) {
    const a = typeof before === 'string' ? this.capture(before) : before;
    const b = typeof after === 'string' ? this.capture(after) : after;
    return { equal: a.stable === b.stable, before: a, after: b };
  }
}

export function expect(locator, options = {}) {
  return new LocatorAssertions(locator, options);
}

export { DEFAULT_TIMEOUT_MS, deepStableEqual, stableString };
