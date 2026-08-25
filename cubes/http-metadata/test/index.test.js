import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HeaderMap,
  buildSetCookie,
  createETag,
  ifMatch,
  ifNoneMatch,
  negotiateAccept,
  negotiateAcceptEncoding,
  negotiateAcceptLanguage,
  parseContentLength,
  parseContentType,
  parseCookieHeader,
} from '../src/index.js';

test('headers are case-insensitive and snapshots are immutable', () => {
  const headers = new HeaderMap().set('Content-Type', 'text/plain').append('X-Test', 'a').append('x-test', 'b');
  assert.equal(headers.get('content-type'), 'text/plain');
  assert.deepEqual(headers.getAll('X-Test'), ['a', 'b']);
  assert.equal(Object.isFrozen(headers.snapshot()), true);
});

test('Cookie parsing and Set-Cookie building follow bounded native semantics', () => {
  assert.deepEqual(parseCookieHeader('SID=abc; lang=en'), { SID: 'abc', lang: 'en' });
  const value = buildSetCookie({ name: 'SID', value: 'abc', Path: '/', HttpOnly: true, Secure: true, SameSite: 'Lax', MaxAge: 60 });
  assert.match(value, /^SID=abc;/);
  assert.match(value, /Path=\//);
  assert.match(value, /HttpOnly/);
  assert.match(value, /Secure/);
  assert.match(value, /SameSite=Lax/);
});

test('content helpers reject unsafe values', () => {
  assert.deepEqual(parseContentType('Application/JSON; Charset="utf-8"'), { type: 'application/json', parameters: { charset: 'utf-8' } });
  assert.equal(parseContentLength('42'), 42);
  assert.throws(() => parseContentLength('-1'), /Content-Length/);
  assert.throws(() => parseContentLength('9007199254740992'), /Content-Length/);
});

test('Accept negotiation honors q-values and specificity', () => {
  const supported = ['text/html', 'application/json'];
  assert.equal(negotiateAccept('application/json;q=0.9, text/html;q=0.5', supported), 'application/json');
  assert.equal(negotiateAccept('text/*;q=0.8, */*;q=0.1', supported), 'text/html');
  assert.equal(negotiateAccept('application/xml', supported), null);
});

test('encoding and language negotiation are deterministic', () => {
  assert.equal(negotiateAcceptEncoding('gzip;q=0.8, br;q=1', ['gzip', 'br']), 'br');
  assert.equal(negotiateAcceptLanguage('en-US;q=1, ar;q=0.8', ['ar-EG', 'en-US']), 'en-US');
});

test('ETags support opaque generation and weak/strong matching', () => {
  const strong = createETag('hello');
  const weak = createETag('hello', { weak: true });
  assert.equal(ifMatch(strong, strong), true);
  assert.equal(ifMatch(weak, strong), false);
  assert.equal(ifNoneMatch(weak, strong), true);
  assert.equal(ifMatch('*', strong), true);
});

test('invalid header names and values fail deterministically', () => {
  assert.throws(() => new HeaderMap().set('bad name', 'x'), /header name/);
  assert.throws(() => new HeaderMap().set('X-Test', 'a\nb'), /forbidden/);
  assert.throws(() => buildSetCookie({ name: 'SID', value: 'a;b' }), /cookie value/);
});
