// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserInteractions, By, InteractionsError, Locator } from '../src/index.js';

/**
 * Minimal in-memory DOM + a fake browser session.
 * The session only needs `.evaluate(expr)` — exactly the contract the cube
 * depends on — so no real browser is required for unit tests. This mirrors the
 * design goal: the interaction cube is fully decoupled and unit-testable.
 */
class MiniNode {
  constructor(tag, attrs = {}, text = '') {
    this.tag = tag;
    this.attrs = { ...attrs };
    this.text = text;
    this.children = [];
    this.disabled = false;
    this.value = '';
    this.checked = false;
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
}

class MiniDom {
  constructor() {
    this.root = new MiniNode('html');
  }
  add(htmlString) {
    const n = parseMini(htmlString);
    this.root.children.push(n);
    return n;
  }
  queryAll() {
    const out = [];
    const walk = (node) => { out.push(node); node.children.forEach(walk); };
    this.root.children.forEach(walk);
    return out;
  }
}

function parseMini(str) {
  const tagMatch = /^<([a-zA-Z0-9]+)([^>]*)>(.*)<\/\1>$/s.exec(str.trim());
  if (!tagMatch) throw new Error('mini parse error: ' + str);
  const tag = tagMatch[1];
  const attrStr = tagMatch[2];
  const inner = tagMatch[3];
  const attrs = {};
  const re = /([a-zA-Z0-9-]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(attrStr))) attrs[m[1]] = m[2];
  const node = new MiniNode(tag, attrs, inner);
  return node;
}

/** A fake session whose evaluate runs the generated IIFEs against MiniDom. */
class FakeSession {
  constructor(dom) { this.dom = dom; this.lastExpr = null; }
  async evaluate(expr) {
    this.lastExpr = expr;
    return this._run(expr);
  }
  _run(expr) {
    if (expr.includes('document.title')) return 'Demo Page';
    if (expr.includes('location.href')) return 'https://example.com/';
    if (expr.includes('document.documentElement.outerHTML')) return '<html><body></body></html>';
    return emulateIIFE(expr, this.dom);
  }
}

/**
 * TEST double that interprets the strategy serialized inside the generated IIFE.
 * Supports css / testId / title / role(,name) / label / text matching.
 */
function emulateIIFE(expr, dom) {
  const all = dom.queryAll();
  const strategy = extractStrategy(expr);
  const nodes = all.filter(n => nodeMatches(n, strategy));

  // Count probe returns `{ count: ... }`.
  if (/return \{ count: nodes\.length \};/.test(expr)) {
    return { count: nodes.length };
  }

  const literalIdx = /nodes\[(\d+)\]/.exec(expr);
  const idx = literalIdx ? Number(literalIdx[1]) : 0;
  const target = idx < nodes.length ? nodes[idx] : null;

  if (expr.includes('getAttribute(') && !expr.includes('dispatchEvent') && !expr.includes('return { found')) {
    const nameMatch = /getAttribute\((['"])([^'"]+)\1\)/.exec(expr);
    return target ? target.getAttribute(nameMatch ? nameMatch[2] : 'x') : null;
  }
  if (expr.includes('dispatchEvent')) return target ? true : false;

  if (!target) return { found: false };
  const visible = target.attrs.style !== 'display:none';
  const disabled = target.disabled === true || target.attrs['aria-disabled'] === 'true';
  return {
    found: true,
    visible,
    disabled,
    value: target.value || null,
    textContent: target.text || '',
    label: target.attrs['aria-label'] || target.attrs.title || '',
    tagName: target.tag.toUpperCase(),
    type: target.attrs.type || null
  };
}

function extractStrategy(expr) {
  const m = /const __strategy = (\{[\s\S]*?\});/.exec(expr);
  if (!m) return { kind: 'css', value: '*' };
  try { return JSON.parse(m[1]); } catch { return { kind: 'css', value: '*' }; }
}

function nodeMatches(node, s) {
  switch (s.kind) {
    case 'css':
      return s.value === '*' ? true : simpleCssMatch(node, s.value);
    case 'testId':
      return node.attrs['data-testid'] === s.value;
    case 'title':
      return node.attrs.title === s.value;
    case 'text':
      return s.exact ? (node.text || '').trim() === s.value : (node.text || '').includes(s.value);
    case 'role':
      if (node.attrs.role !== s.value && node.tag.toLowerCase() !== s.value.toLowerCase()) return false;
      if (s.name != null) {
        const lbl = node.attrs['aria-label'] || node.attrs.title || '';
        if (lbl.trim() !== s.name) return false;
      }
      return true;
    case 'label': {
      const aria = node.attrs['aria-label'] || node.attrs.title || '';
      return aria.trim() === s.value;
    }
    default:
      return false;
  }
}

function simpleCssMatch(node, sel) {
  if (sel.startsWith('[data-testid=')) return node.attrs['data-testid'] === sel.slice(13, -2);
  if (sel.startsWith('[role=')) return node.attrs.role === sel.slice(7, -2);
  if (sel.startsWith('[title=')) return node.attrs.title === sel.slice(8, -2);
  if (sel.startsWith('#')) return node.attrs.id === sel.slice(1);
  if (sel.startsWith('.')) return (node.attrs.class || '').split(/\s+/).includes(sel.slice(1));
  return node.tag === sel;
}

function makeSessionWithElements() {
  const dom = new MiniDom();
  dom.add('<button role="button" aria-label="Submit" data-testid="submit">Submit</button>');
  dom.add('<input id="email" type="text" aria-label="Email" value=""></input>');
  dom.add('<a href="#" title="Home">Home</a>');
  dom.add('<h1 role="heading" aria-label="Title">Title</h1>');
  return new FakeSession(dom);
}

test('By strategies build without error', () => {
  assert.equal(By.css('#x').kind, 'css');
  assert.equal(By.text('Hi').value, 'Hi');
  assert.equal(By.role('button', { name: 'Submit' }).name, 'Submit');
  assert.equal(By.testId('abc').value, 'abc');
  assert.throws(() => By.css(''), err => err instanceof InteractionsError && err.code === 'INVALID_SELECTOR');
});

test('constructor rejects a session without evaluate()', () => {
  assert.throws(() => new BrowserInteractions({}), err => err instanceof InteractionsError && err.code === 'INVALID_SESSION');
});

test('count returns matched element count', async () => {
  const page = new BrowserInteractions(makeSessionWithElements());
  const n = await page.locator(By.role('button')).count();
  assert.equal(n, 1);
});

test('waitForVisible resolves when element is visible', async () => {
  const page = new BrowserInteractions(makeSessionWithElements());
  const submit = page.locator(By.role('button', { name: 'Submit' }));
  await submit.waitForVisible({ timeoutMs: 1000 });
  const txt = await submit.textContent();
  assert.equal(txt, 'Submit');
});

test('strict mode throws when multiple matches', async () => {
  const dom = new MiniDom();
  dom.add('<a href="#" title="x">1</a>');
  dom.add('<a href="#" title="x">2</a>');
  const page = new BrowserInteractions(new FakeSession(dom));
  await assert.rejects(
    () => page.locator(By.title('x')).waitForVisible({ timeoutMs: 500 }),
    err => err instanceof InteractionsError && err.code === 'STRICT_VIOLATION'
  );
});

test('click resolves and dispatches events', async () => {
  const page = new BrowserInteractions(makeSessionWithElements());
  await page.locator(By.testId('submit')).click({ timeoutMs: 1000 });
  assert.ok(true);
});

test('fill sets value via input event path', async () => {
  const page = new BrowserInteractions(makeSessionWithElements());
  await page.css('#email').fill('user@example.com', { timeoutMs: 1000 });
  assert.ok(true);
});

test('waitFor times out with retryable error', async () => {
  const dom = new MiniDom();
  const page = new BrowserInteractions(new FakeSession(dom));
  await assert.rejects(
    () => page.locator(By.css('#missing')).waitFor({ timeoutMs: 200 }),
    err => err instanceof InteractionsError && err.code === 'WAIT_TIMEOUT' && err.retryable === true
  );
});

test('nth selects indexed element', async () => {
  const dom = new MiniDom();
  dom.add('<li>one</li>');
  dom.add('<li>two</li>');
  const page = new BrowserInteractions(new FakeSession(dom));
  const second = page.locator(By.css('li')).nth(1);
  assert.ok(second instanceof Locator);
});

test('nth(index) bypasses strict-mode count check (regression)', async () => {
  const dom = new MiniDom();
  dom.add('<li>one</li>');
  dom.add('<li>two</li>');
  dom.add('<li>three</li>');
  const page = new BrowserInteractions(new FakeSession(dom));
  // An explicit index disambiguates the locator, so strict mode must NOT throw
  // STRICT_VIOLATION even though 3 <li> elements exist.
  const third = page.locator(By.css('li')).nth(2);
  await third.waitForVisible({ timeoutMs: 500 });
  assert.ok(true);
});

test('errors carry stable codes and retryable flag', () => {
  const e = new InteractionsError('X', 'msg', { retryable: true });
  assert.equal(e.code, 'X');
  assert.equal(e.retryable, true);
});
