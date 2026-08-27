// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

/**
 * Browser Recorder Cube v0.1
 *
 * Records a sequence of browser interactions into a replayable, serializable
 * script. Zero third-party dependencies. Designed as the Sovereign alternative
 * to Playwright Codegen / Cypress recording — local-first, emit-friendly, and
 * fully unit-testable via a fake interactions layer.
 */

export class RecorderError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'RecorderError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    Object.freeze(this);
  }
}

function fail(code, message, options) {
  throw new RecorderError(code, message, options);
}

/**
 * A Recorder wraps a page (any object exposing locator/css + an interactions
 * facade) and records each action as a step. Each step is a plain, JSON-safe
 * object so it can be stored, diffed, or replayed deterministically.
 */
export class BrowserRecorder {
  constructor(page, options = {}) {
    if (!page || typeof page.locator !== 'function') {
      fail('INVALID_PAGE', 'Recorder requires a page with a locator() method');
    }
    this.page = page;
    this.steps = [];
    this._captureSnapshot = options.captureSnapshot !== false;
    this._snapshotFn = typeof options.snapshot === 'function' ? options.snapshot : null;
    // Optional redactor: (params, step) => params applied to every recorded step's
    // params. Use to mask sensitive data (e.g. fill values on password fields)
    // before it is persisted by getScript(). Default: identity (no redaction).
    this._redact = typeof options.redact === 'function' ? options.redact : null;
  }

  async _record(kind, target, params = {}) {
    const redacted = this._redact ? this._redact({ ...params }, { kind, target }) : params;
    const step = Object.freeze({
      kind,
      target: target ? { ...target } : null,
      params: { ...(redacted || params) },
      at: 0
    });
    if (this._captureSnapshot && this._snapshotFn) {
      try { step.snapshot = this._snapshotFn(); } catch { /* non-fatal */ }
    }
    this.steps.push(step);
    return step;
  }

  /** Locate by a By strategy, record the locator, return the live locator. */
  locator(strategy, options) {
    this._record('locate', strategy, options || {});
    return this.page.locator(strategy, options);
  }

  async click(strategy, options = {}) {
    const loc = this.locator(strategy, options);
    const result = await loc.click(options);
    await this._record('click', strategy, options);
    return result;
  }

  async fill(strategy, value, options = {}) {
    const loc = this.locator(strategy, options);
    const result = await loc.fill(value, options);
    await this._record('fill', strategy, { ...options, value });
    return result;
  }

  async press(strategy, key, options = {}) {
    const loc = this.locator(strategy, options);
    const result = await loc.press(key, options);
    await this._record('press', strategy, { ...options, key });
    return result;
  }

  getScript() {
    return Object.freeze(this.steps.map(s => ({ ...s })));
  }

  clear() { this.steps = []; }

  /** Replay recorded steps against any compatible interactions layer. */
  async replay(interactions, options = {}) {
    if (!interactions || typeof interactions.locator !== 'function') {
      fail('INVALID_REPLAY_TARGET', 'replay requires an interactions layer with locator()');
    }
    const timeoutMs = options.timeoutMs ?? 5000;
    for (const step of this.steps) {
      const loc = interactions.locator(step.target, {});
      switch (step.kind) {
        case 'click': await loc.click({ timeoutMs }); break;
        case 'fill': await loc.fill(step.params.value, { timeoutMs }); break;
        case 'press': await loc.press(step.params.key, { timeoutMs }); break;
        case 'locate': break; // no-op on replay
        default: fail('UNKNOWN_STEP', `Cannot replay step kind: ${step.kind}`);
      }
    }
    return this.steps.length;
  }
}


