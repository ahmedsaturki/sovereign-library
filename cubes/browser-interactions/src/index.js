// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

/**
 * Browser Interactions Cube v0.1
 *
 * Standalone, dependency-free interaction layer for the Sovereign Browser Cube.
 * Depends ONLY on the `session.evaluate(expression, returnByValue)` contract.
 *
 * Differentiators vs Selenium/Playwright/Puppeteer (all reviewed from their
 * public source and docs before design):
 *  - Zero third-party dependencies (uses only `node:` + the browser session).
 *  - Deterministic error taxonomy with stable codes + retryable flags.
 *  - Bounded, deadline-driven polling only (no fixed sleeps in the hot path).
 *  - Pure capability injection: a fake session makes it 100% unit-testable.
 *  - Auto-waiting "actionability" probe before every action (Playwright-style),
 *    but implemented with no framework and no ambiguity about timeouts.
 */

export class InteractionsError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'InteractionsError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    Object.freeze(this);
  }
}

function fail(code, message, options) {
  throw new InteractionsError(code, message, options);
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_MS = 50;
const MAX_POLL_MS = 250;

function validatePositiveInt(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail('INVALID_OPTION', `${label} must be a positive safe integer`);
  }
}

function clampPoll(ms) {
  if (!Number.isSafeInteger(ms) || ms < 1) return DEFAULT_POLL_MS;
  return Math.min(ms, MAX_POLL_MS);
}

function sleepBackoff(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeForSelector(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}

/**
 * Locator strategies. Each resolves to an in-page matcher spec (serializable)
 * so the cube stays backend-agnostic (Chromium/Firefox/WebKit/any DOM).
 */
export const By = Object.freeze({
  css(selector) {
    if (typeof selector !== 'string' || !selector) fail('INVALID_SELECTOR', 'css selector must be a non-empty string');
    return { kind: 'css', value: selector };
  },
  text(text, { exact = false } = {}) {
    if (typeof text !== 'string' || !text) fail('INVALID_SELECTOR', 'text must be a non-empty string');
    return { kind: 'text', value: text, exact: Boolean(exact) };
  },
  /** @param {{name?: string|null, level?: number|null}} [options] */
  role(role, options = {}) {
    const { name = null, level = null } = options;
    if (typeof role !== 'string' || !role) fail('INVALID_SELECTOR', 'role must be a non-empty string');
    return { kind: 'role', value: role, name: name ?? null, level: level ?? null };
  },
  label(label) {
    if (typeof label !== 'string' || !label) fail('INVALID_SELECTOR', 'label must be a non-empty string');
    return { kind: 'label', value: label };
  },
  title(title) {
    if (typeof title !== 'string' || !title) fail('INVALID_SELECTOR', 'title must be a non-empty string');
    return { kind: 'title', value: title };
  },
  testId(testId) {
    if (typeof testId !== 'string' || !testId) fail('INVALID_SELECTOR', 'testId must be a non-empty string');
    return { kind: 'testId', value: testId };
  }
});

/**
 * Build the in-page IIFE that finds candidate nodes and returns structured
 * probe data. The matcher logic runs entirely inside the page to keep the
 * Node side deterministically serializable and side-effect free.
 */
function buildProbe(strategy) {
  const s = { ...strategy };
  return `(() => {
  const __strategy = ${JSON.stringify(s)};
  function __matches(node) {
    switch (__strategy.kind) {
      case 'css': return true;
      case 'testId': return node.getAttribute('data-testid') === __strategy.value;
      case 'title': return node.getAttribute('title') === __strategy.value;
      case 'text': {
        const t = (node.textContent || '').trim();
        return __strategy.exact ? t === __strategy.value : t.includes(__strategy.value);
      }
      case 'role': {
        let ok = node.getAttribute('role') === __strategy.value || node.tagName === __strategy.value.toUpperCase();
        if (__strategy.level != null && node.tagName && node.tagName.toLowerCase() !== ('h' + __strategy.level)) {
          const h = /h([1-6])/i.exec(node.tagName);
          if (!h || Number(h[1]) !== __strategy.level) ok = false;
        }
        if (ok && __strategy.name != null) {
          const lbl = node.getAttribute('aria-label') || node.getAttribute('title') || node.getAttribute('aria-labelledby') || (node.labels && node.labels[0] && node.labels[0].textContent) || '';
          ok = lbl.trim() === __strategy.name;
        }
        return ok;
      }
      case 'label': {
        if (node.id) {
          const lab = document.querySelector('label[for="' + node.id.replace(/"/g, '\\\\"') + '"]');
          if (lab && (lab.textContent || '').trim() === __strategy.value) return true;
        }
        if (node.labels && node.labels.length) {
          for (const l of node.labels) if ((l.textContent || '').trim() === __strategy.value) return true;
        }
        const aria = node.getAttribute('aria-label') || node.getAttribute('title') || '';
        return aria.trim() === __strategy.value;
      }
      default: return false;
    }
  }
  function __collect(root) {
    if (__strategy.kind === 'css') {
      try { return Array.from(root.querySelectorAll(__strategy.value)); } catch (e) { return { __error: String(e && e.message || e) }; }
    }
    const all = Array.from(root.querySelectorAll('*'));
    return all.filter(__matches);
  }
  const collected = __collect(document);
  if (Array.isArray(collected) === false && collected && collected.__error) {
    return { error: 'INVALID_SELECTOR', message: collected.__error };
  }
  let nodes = collected;
  return { count: nodes.length };
})()`;
}

function buildInspect(strategy, index) {
  const idx = Number(index);
  return `(() => {
  const __strategy = ${JSON.stringify(strategy)};
  function __matches(node) {
    switch (__strategy.kind) {
      case 'css': return true;
      case 'testId': return node.getAttribute('data-testid') === __strategy.value;
      case 'title': return node.getAttribute('title') === __strategy.value;
      case 'text': { const t = (node.textContent || '').trim(); return __strategy.exact ? t === __strategy.value : t.includes(__strategy.value); }
      case 'role': {
        let ok = node.getAttribute('role') === __strategy.value || node.tagName === __strategy.value.toUpperCase();
        if (__strategy.level != null) { const h = /h([1-6])/i.exec(node.tagName); const want = 'h' + __strategy.level; if (node.tagName !== want && (!h || Number(h[1]) !== __strategy.level)) ok = false; }
        if (ok && __strategy.name != null) { const lbl = node.getAttribute('aria-label') || node.getAttribute('title') || ''; ok = lbl.trim() === __strategy.name; }
        return ok;
      }
      case 'label': {
        if (node.id) { const lab = document.querySelector('label[for="' + node.id.replace(/"/g, '\\\\"') + '"]'); if (lab && (lab.textContent || '').trim() === __strategy.value) return true; }
        if (node.labels && node.labels.length) { for (const l of node.labels) if ((l.textContent || '').trim() === __strategy.value) return true; }
        const aria = node.getAttribute('aria-label') || node.getAttribute('title') || ''; return aria.trim() === __strategy.value;
      }
      default: return false;
    }
  }
  let nodes = __strategy.kind === 'css' ? (() => { try { return Array.from(document.querySelectorAll(__strategy.value)); } catch (e) { return { __error: String(e && e.message || e) }; } })() : Array.from(document.querySelectorAll('*')).filter(__matches);
  if (nodes && nodes.__error) return { error: 'INVALID_SELECTOR', message: nodes.__error };
  const target = ${idx} == null ? nodes[0] : nodes[${idx}];
  if (!target) return { found: false };
  const rect = target.getBoundingClientRect();
  const style = window.getComputedStyle(target);
  const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
  const disabled = target.disabled === true || target.getAttribute('aria-disabled') === 'true';
  let value = null;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    value = (target.type === 'checkbox' || target.type === 'radio') ? target.checked : target.value;
  }
  return { found: true, visible, disabled, value, textContent: (target.textContent || '').trim(), label: target.getAttribute('aria-label') || target.getAttribute('title') || '', tagName: target.tagName, type: target.type || null };
})()`;
}

function buildAction(kind, strategy, index, payload) {
  const p = payload === undefined ? 'undefined' : JSON.stringify(payload);
  return `(() => {
  const __strategy = ${JSON.stringify(strategy)};
  function __matches(node) {
    switch (__strategy.kind) {
      case 'css': return true;
      case 'testId': return node.getAttribute('data-testid') === __strategy.value;
      case 'title': return node.getAttribute('title') === __strategy.value;
      case 'text': { const t = (node.textContent || '').trim(); return __strategy.exact ? t === __strategy.value : t.includes(__strategy.value); }
      case 'role': { let ok = node.getAttribute('role') === __strategy.value || node.tagName === __strategy.value.toUpperCase(); if (ok && __strategy.name != null) { const lbl = node.getAttribute('aria-label') || node.getAttribute('title') || ''; ok = lbl.trim() === __strategy.name; } return ok; }
      default: return false;
    }
  }
  let nodes = __strategy.kind === 'css' ? Array.from(document.querySelectorAll(__strategy.value)) : Array.from(document.querySelectorAll('*')).filter(__matches);
  const t = ${index} == null ? nodes[0] : nodes[${index}];
  if (!t) return false;
  const kind = ${JSON.stringify(kind)};
  if (kind === 'click') { const r = t.getBoundingClientRect(); const x = r.left + r.width/2, y = r.top + r.height/2; t.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:x,clientY:y})); t.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:x,clientY:y})); t.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y})); return true; }
  if (kind === 'focus') { t.focus(); t.dispatchEvent(new FocusEvent('focus',{bubbles:true})); return true; }
  if (kind === 'fill') { const proto = t.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto,'value').set; setter.call(t, ${p}); t.dispatchEvent(new Event('input',{bubbles:true})); t.dispatchEvent(new Event('change',{bubbles:true})); return true; }
  if (kind === 'press') { const k = ${p}; t.focus(); t.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true})); t.dispatchEvent(new KeyboardEvent('keyup',{key:k,bubbles:true})); return true; }
  if (kind === 'clear') { const proto = t.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto,'value').set; setter.call(t, ''); t.dispatchEvent(new Event('input',{bubbles:true})); return true; }
  return false;
})()`;
}

function buildAttr(strategy, index, name) {
  return `(() => {
  const __strategy = ${JSON.stringify(strategy)};
  function __matches(node) { return __strategy.kind === 'css' ? true : node.getAttribute('data-testid') === __strategy.value; }
  let nodes = __strategy.kind === 'css' ? Array.from(document.querySelectorAll(__strategy.value)) : Array.from(document.querySelectorAll('*')).filter(__matches);
  const t = ${index} == null ? nodes[0] : nodes[${index}];
  return t ? t.getAttribute(${JSON.stringify(name)}) : null;
})()`;
}

export class Locator {
  constructor(page, strategy, options = {}) {
    this.page = page;
    this.strategy = strategy;
    this.hasIndex = options.index != null;
    this.index = options.index ?? null;
    this.strict = options.strict ?? true;
    this.timeoutMs = options.timeoutMs ?? page.timeoutMs;
    validatePositiveInt(this.timeoutMs, 'timeoutMs');
  }

  _opts() {
    return { index: this.hasIndex ? this.index : undefined, strict: this.strict, timeoutMs: this.timeoutMs };
  }

  async _probeCount() {
    const res = await this.page.session.evaluate(buildProbe(this.strategy));
    if (res && res.error === 'INVALID_SELECTOR') fail('INVALID_SELECTOR', res.message, { retryable: false });
    if (!res || typeof res.count !== 'number') fail('PROBE_FAILED', 'Probe returned no result', { retryable: true });
    return res.count;
  }

  async _probeNode() {
    const res = await this.page.session.evaluate(buildInspect(this.strategy, this.hasIndex ? this.index : null));
    if (res && res.error === 'INVALID_SELECTOR') fail('INVALID_SELECTOR', res.message, { retryable: false });
    return res;
  }

  async _assertSingle() {
    const count = await this._probeCount();
    if (count > 1) fail('STRICT_VIOLATION', `Strict mode: ${count} elements matched, expected exactly 1`, { retryable: false });
  }

  async waitFor(options = {}) {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    validatePositiveInt(timeoutMs, 'timeoutMs');
    const deadline = Date.now() + timeoutMs;
    let poll = DEFAULT_POLL_MS;
    while (true) {
      const count = await this._probeCount();
      if (count > 0) {
        // An explicit index (nth) already disambiguates the locator, so strict
        // mode's "exactly one match" check is bypassed — it only guards
        // ambiguous (non-indexed) locators.
        if (this.strict && !this.hasIndex) await this._assertSingle();
        return this;
      }
      if (Date.now() >= deadline) fail('WAIT_TIMEOUT', `Element not found within ${timeoutMs}ms`, { retryable: true });
      await sleepBackoff(poll);
      poll = clampPoll(poll * 1.5);
    }
  }

  async waitForVisible(options = {}) {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    validatePositiveInt(timeoutMs, 'timeoutMs');
    const deadline = Date.now() + timeoutMs;
    let poll = DEFAULT_POLL_MS;
    while (true) {
      const res = await this._probeNode();
      if (res && res.found && res.visible) {
        // Bypass strict-mode count check when an explicit index (nth) was set.
        if (this.strict && !this.hasIndex) await this._assertSingle();
        return this;
      }
      if (Date.now() >= deadline) fail('WAIT_TIMEOUT', `Element not visible within ${timeoutMs}ms`, { retryable: true });
      await sleepBackoff(poll);
      poll = clampPoll(poll * 1.5);
    }
  }

  async count() {
    return this._probeCount();
  }

  async isVisible() {
    const res = await this._probeNode();
    return Boolean(res && res.found && res.visible);
  }

  async isEnabled() {
    const res = await this._probeNode();
    return Boolean(res && res.found && res.visible && !res.disabled);
  }

  async textContent() {
    const res = await this._probeNode();
    if (!res || !res.found) fail('ELEMENT_NOT_FOUND', 'No element matched locator', { retryable: true });
    return res.textContent ?? '';
  }

  async value() {
    const res = await this._probeNode();
    if (!res || !res.found) fail('ELEMENT_NOT_FOUND', 'No element matched locator', { retryable: true });
    return res.value;
  }

  async getAttribute(name) {
    if (typeof name !== 'string' || !name) fail('INVALID_OPTION', 'attribute name must be a non-empty string');
    const res = await this.page.session.evaluate(buildAttr(this.strategy, this.hasIndex ? this.index : null, name));
    return res;
  }

  async click(options = {}) {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    await this.waitForVisible({ timeoutMs });
    const ok = await this.page.session.evaluate(buildAction('click', this.strategy, this.hasIndex ? this.index : null));
    if (!ok) fail('CLICK_FAILED', 'Click target missing', { retryable: true });
    return this;
  }

  async fill(value, options = {}) {
    if (value == null) fail('INVALID_OPTION', 'fill value must not be null');
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    await this.waitForVisible({ timeoutMs });
    const ok = await this.page.session.evaluate(buildAction('fill', this.strategy, this.hasIndex ? this.index : null, value));
    if (!ok) fail('FILL_FAILED', 'Fill target missing', { retryable: true });
    return this;
  }

  async press(key, options = {}) {
    if (typeof key !== 'string' || !key) fail('INVALID_OPTION', 'press key must be a non-empty string');
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    await this.waitForVisible({ timeoutMs });
    const ok = await this.page.session.evaluate(buildAction('press', this.strategy, this.hasIndex ? this.index : null, key));
    if (!ok) fail('PRESS_FAILED', 'Press target missing', { retryable: true });
    return this;
  }

  async focus(options = {}) {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    await this.waitForVisible({ timeoutMs });
    const ok = await this.page.session.evaluate(buildAction('focus', this.strategy, this.hasIndex ? this.index : null));
    if (!ok) fail('FOCUS_FAILED', 'Focus target missing', { retryable: true });
    return this;
  }

  async clear(options = {}) {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    await this.waitForVisible({ timeoutMs });
    const ok = await this.page.session.evaluate(buildAction('clear', this.strategy, this.hasIndex ? this.index : null));
    if (!ok) fail('CLEAR_FAILED', 'Clear target missing', { retryable: true });
    return this;
  }

  nth(index) {
    if (!Number.isSafeInteger(index) || index < 0) fail('INVALID_OPTION', 'nth index must be a non-negative integer');
    return new Locator(this.page, this.strategy, { ...this._opts(), index });
  }
}

export class BrowserInteractions {
  constructor(session, options = {}) {
    if (!session || typeof session.evaluate !== 'function') {
      fail('INVALID_SESSION', 'BrowserInteractions requires a session with an evaluate() method');
    }
    this.session = session;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    validatePositiveInt(this.timeoutMs, 'timeoutMs');
  }

  locator(strategy, options = {}) {
    return new Locator(this, strategy, options);
  }

  css(selector, options = {}) {
    return this.locator(By.css(selector), options);
  }

  async title() {
    return this.session.evaluate('document.title');
  }

  async url() {
    return this.session.evaluate('location.href');
  }

  async content() {
    return this.session.evaluate('document.documentElement.outerHTML');
  }
}

export { DEFAULT_TIMEOUT_MS, DEFAULT_POLL_MS };
