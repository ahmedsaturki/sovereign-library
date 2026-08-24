import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserCubeError, createSessionState, transition, validateUrl } from './index.js';

test('validateUrl accepts http and https', () => {
  assert.equal(validateUrl('https://example.com').protocol, 'https:');
  assert.equal(validateUrl('http://example.com').protocol, 'http:');
});

test('validateUrl rejects unsupported protocols', () => {
  assert.throws(() => validateUrl('file:///tmp/x'), error => error instanceof BrowserCubeError && error.code === 'UNSUPPORTED_PROTOCOL');
});

test('session lifecycle is deterministic', () => {
  let state = createSessionState();
  state = transition(state, 'starting');
  state = transition(state, 'running');
  state = transition(state, 'closing');
  state = transition(state, 'closed');
  assert.equal(state.state, 'closed');
});

test('invalid lifecycle transitions are rejected', () => {
  const state = createSessionState();
  assert.throws(() => transition(state, 'running'), error => error instanceof BrowserCubeError && error.code === 'INVALID_LIFECYCLE');
});
