// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

/**
 * Browser Visual Testing Cube v0.1
 *
 * Structural DOM snapshot capture + deterministic diffing. Zero third-party deps.
 * Normalizes HTML (lowercase tags, sorted attributes, trimmed text) so snapshots
 * are canonical and stable across renders.
 */

export class VisualError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'VisualError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    Object.freeze(this);
  }
}

function fail(code, message, options) {
  throw new VisualError(code, message, options);
}

/** Tokenize normalized HTML into a flat list of node descriptors. */
function tokenize(html) {
  if (typeof html !== 'string') fail('INVALID_INPUT', 'snapshot source must be a string');
  const tokens = [];
  const re = /<\/?([a-zA-Z0-9]+)((?:\s+[a-zA-Z0-9-]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[3] != null) {
      const text = m[3].replace(/\s+/g, ' ').trim();
      if (text) tokens.push({ type: 'text', value: text });
      continue;
    }
    const tag = m[1].toLowerCase();
    const attrStr = m[2] || '';
    const attrs = {};
    const attrRe = /([a-zA-Z0-9-]+)(?:="([^"]*)")?/g;
    let a;
    while ((a = attrRe.exec(attrStr))) {
      const name = a[1].toLowerCase();
      if (name === 'class') attrs.class = (a[2] || '').split(/\s+/).filter(Boolean).sort().join(' ');
      else if (name !== 'style') attrs[name] = a[2] ?? '';
    }
    const attrKey = Object.keys(attrs).sort().map(k => `${k}=${attrs[k]}`).join('|');
    const closing = m[0].startsWith('</');
    const selfClose = m[0].endsWith('/>');
    tokens.push({ type: 'tag', tag, attrKey, closing, selfClose });
  }
  return tokens;
}

export class VisualTester {
  constructor() {
    this._baselines = new Map();
  }

  /** Canonical, stable representation of an HTML snapshot. */
  capture(html) {
    const tokens = tokenize(html);
    const canonical = tokens.map(t =>
      t.type === 'text' ? `#text:${t.value}` : `${t.closing ? '/' : ''}${t.tag}${t.attrKey ? `{${t.attrKey}}` : ''}`
    ).join('\n');
    return Object.freeze({ html: html.trim(), canonical, tokens: tokens.length });
  }

  /** Diff two HTML snapshots, returning a bounded structural report. */
  diff(before, after) {
    const a = typeof before === 'string' ? this.capture(before) : before;
    const b = typeof after === 'string' ? this.capture(after) : after;
    const added = b.canonical.split('\n').filter(l => !a.canonical.includes(l));
    const removed = a.canonical.split('\n').filter(l => !b.canonical.includes(l));
    return Object.freeze({
      equal: a.canonical === b.canonical,
      added: added.slice(0, 100),
      removed: removed.slice(0, 100),
      addedCount: added.length,
      removedCount: removed.length
    });
  }

  baseline(name, html) {
    if (typeof name !== 'string' || !name) fail('INVALID_NAME', 'baseline name must be a non-empty string');
    this._baselines.set(name, this.capture(html));
    return true;
  }

  compare(name, html) {
    if (!this._baselines.has(name)) fail('NO_BASELINE', `No baseline registered for "${name}"`);
    return this.diff(this._baselines.get(name), html);
  }
}

export { tokenize };
