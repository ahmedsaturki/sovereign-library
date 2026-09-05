// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

/**
 * Browser Tab Manager Cube v0.1
 *
 * Multi-tab orchestration over CDP Target domain. Zero third-party deps.
 * Capability-injectable: works against any object with `on/send` plus a session
 * factory (so it is unit-testable without a real browser).
 */

export class TabManagerError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'TabManagerError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    Object.freeze(this);
  }
}

function fail(code, message, options) {
  throw new TabManagerError(code, message, options);
}

export class TabManager {
  constructor(cdp, options = {}) {
    if (!cdp || typeof cdp.on !== 'function' || typeof cdp.send !== 'function') {
      fail('INVALID_CDP', 'TabManager requires a CDP connection with on() and send()');
    }
    this.cdp = cdp;
    this.tabs = new Map();
    this.activeId = null;
    this._unsub = [];
    this._enabled = false;
    this._makeSession = typeof options.makeSession === 'function' ? options.makeSession : (id) => ({ id, cdp, sessionId: id });
  }

  async enable() {
    if (this._enabled) return;
    this._unsub.push(this.cdp.on('Target.targetCreated', e => this.#onCreated(e)));
    this._unsub.push(this.cdp.on('Target.targetDestroyed', e => this.#onDestroyed(e)));
    this._unsub.push(this.cdp.on('Target.targetInfoChanged', e => this.#onInfo(e)));
    const { targetInfos } = await this.cdp.send('Target.getTargets');
    for (const t of targetInfos || []) this.#index(t);
    this._enabled = true;
  }

  #index(info) {
    if (!info || !info.targetId) return;
    const entry = { id: info.targetId, type: info.type || 'page', url: info.url || '', title: info.title || '', attached: info.attached ?? false };
    this.tabs.set(info.targetId, entry);
  }

  #onCreated(e) { this.#index(e.targetInfo); }
  #onDestroyed(e) { this.tabs.delete(e.targetId); if (this.activeId === e.targetId) this.activeId = null; }
  #onInfo(e) { this.#index(e.targetInfo); }

  /** Open a new tab and return its interaction session. */
  async open(url = 'about:blank') {
    const { targetId } = await this.cdp.send('Target.createTarget', { url });
    const attached = await this.cdp.send('Target.attachToTarget', { targetId, flatten: true });
    this.activeId = targetId;
    this.#index({ targetId, type: 'page', url, title: '' });
    return this._makeSession(targetId, attached.sessionId);
  }

  async close(targetId = this.activeId) {
    if (!targetId) fail('NO_TARGET', 'No target specified and none active');
    await this.cdp.send('Target.closeTarget', { targetId });
    this.tabs.delete(targetId);
    if (this.activeId === targetId) this.activeId = null;
  }

  list() {
    return Object.freeze([...this.tabs.values()].map(t => Object.freeze({ ...t })));
  }

  getActive() {
    return this.activeId ? this._makeSession(this.activeId) : null;
  }

  /** Detach listeners (keeps tabs). */
  async destroy() {
    for (const unsub of this._unsub) { try { unsub(); } catch {} }
    this._unsub = [];
    this._enabled = false;
  }
}

export { };
