import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcceptKey, createClientKey, decodeFrames, encodeFrame, frameClose, frameText, framePing, WebSocketCubeError } from '../src/index.js';

test('accept key matches RFC6455 example', () => {
  assert.equal(createAcceptKey('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
});

test('client key is 16 random bytes encoded as base64', () => {
  const key = createClientKey(() => Buffer.alloc(16, 7));
  assert.equal(key, Buffer.alloc(16, 7).toString('base64'));
});

test('server frame encodes unmasked text and decodes it', () => {
  const encoded = frameText('hello');
  const decoded = decodeFrames(encoded, { fromClient: false });
  assert.equal(decoded.remainder.length, 0);
  assert.equal(decoded.frames.length, 1);
  assert.equal(decoded.frames[0].opcode, 1);
  assert.equal(decoded.frames[0].payload.toString(), 'hello');
  assert.equal(decoded.frames[0].masked, false);
});

test('client frame masks payload deterministically', () => {
  const encoded = encodeFrame({ opcode: 1, payload: 'hello', mask: true, maskingKey: Buffer.from([1, 2, 3, 4]) });
  const decoded = decodeFrames(encoded, { fromClient: true });
  assert.equal(decoded.frames[0].payload.toString(), 'hello');
  assert.equal(decoded.frames[0].masked, true);
});

test('partial frame returns remainder instead of corrupting parser state', () => {
  const encoded = frameText('hello');
  const partial = encoded.subarray(0, encoded.length - 1);
  const decoded = decodeFrames(partial, { fromClient: false });
  assert.equal(decoded.frames.length, 0);
  assert.equal(decoded.remainder.equals(partial), true);
});

test('control frames must be final and <= 125 bytes', () => {
  assert.throws(() => encodeFrame({ opcode: 9, payload: Buffer.alloc(126) }), error => error instanceof WebSocketCubeError && error.code === 'INVALID_CONTROL_FRAME');
  assert.throws(() => encodeFrame({ opcode: 9, payload: Buffer.alloc(1), fin: false }), error => error instanceof WebSocketCubeError && error.code === 'INVALID_CONTROL_FRAME');
});

test('server rejects unmasked client frames', () => {
  const encoded = frameText('hello');
  assert.throws(() => decodeFrames(encoded, { fromClient: true }), error => error instanceof WebSocketCubeError && error.code === 'CLIENT_FRAME_UNMASKED');
});

test('client rejects masked server frames', () => {
  const encoded = encodeFrame({ opcode: 1, payload: 'hello', mask: true, maskingKey: Buffer.from([1, 2, 3, 4]) });
  assert.throws(() => decodeFrames(encoded, { fromClient: false }), error => error instanceof WebSocketCubeError && error.code === 'SERVER_FRAME_MASKED');
});

test('payload limit is enforced before allocation of application message', () => {
  const encoded = framePing(Buffer.alloc(10));
  assert.throws(() => decodeFrames(encoded, { fromClient: false, maxPayloadBytes: 5 }), error => error instanceof WebSocketCubeError && error.code === 'PAYLOAD_TOO_LARGE');
});

test('invalid opcodes and close payloads are rejected', () => {
  assert.throws(() => encodeFrame({ opcode: 3, payload: Buffer.alloc(0) }), error => error instanceof WebSocketCubeError && error.code === 'UNSUPPORTED_OPCODE');
  assert.throws(() => encodeFrame({ opcode: 8, payload: Buffer.from([0]) }), error => error instanceof WebSocketCubeError && error.code === 'INVALID_CLOSE_PAYLOAD');
  assert.throws(() => frameClose(1005), error => error instanceof WebSocketCubeError && error.code === 'INVALID_CLOSE_CODE');
});

test('invalid UTF-8 text is rejected', () => {
  const invalid = encodeFrame({ opcode: 1, payload: Buffer.from([0xff]), mask: false });
  assert.throws(() => decodeFrames(invalid, { fromClient: false }), error => error instanceof WebSocketCubeError && error.code === 'INVALID_UTF8');
});
