import { createHash, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_CONTROL_PAYLOAD = 125;

export class WebSocketCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'WebSocketCubeError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    this.cause = options.cause;
  }
}

export function createAcceptKey(clientKey) {
  if (typeof clientKey !== 'string' || clientKey.trim() === '') {
    throw new WebSocketCubeError('INVALID_CLIENT_KEY', 'clientKey must be a non-empty string');
  }
  return createHash('sha1').update(clientKey.trim() + GUID).digest('base64');
}

export function createClientKey(randomSource = randomBytes) {
  const bytes = randomSource(16);
  if (!Buffer.isBuffer(bytes) || bytes.length !== 16) {
    throw new WebSocketCubeError('INVALID_RANDOM_SOURCE', 'random source must return exactly 16 bytes');
  }
  return bytes.toString('base64');
}

function ensurePayload(payload) {
  if (typeof payload === 'string') return Buffer.from(payload, 'utf8');
  if (Buffer.isBuffer(payload)) return payload;
  if (payload instanceof Uint8Array) return Buffer.from(payload);
  throw new WebSocketCubeError('INVALID_PAYLOAD', 'payload must be string, Buffer, or Uint8Array');
}

export function encodeFrame({ opcode = 1, payload = Buffer.alloc(0), fin = true, mask = false, maskingKey = null }) {
  if (!Number.isInteger(opcode) || opcode < 0 || opcode > 0xf) {
    throw new WebSocketCubeError('INVALID_OPCODE', 'opcode must be a 4-bit integer');
  }
  const data = ensurePayload(payload);
  const isControl = opcode >= 8;
  if (isControl && (!fin || data.length > MAX_CONTROL_PAYLOAD)) {
    throw new WebSocketCubeError('INVALID_CONTROL_FRAME', 'control frames must be final and <= 125 bytes');
  }
  if (data.length > Number.MAX_SAFE_INTEGER) {
    throw new WebSocketCubeError('PAYLOAD_TOO_LARGE', 'payload is too large');
  }
  const key = mask ? (maskingKey ? ensurePayload(maskingKey) : randomBytes(4)) : null;
  if (mask && key.length !== 4) throw new WebSocketCubeError('INVALID_MASK', 'masking key must be 4 bytes');

  let header;
  const first = (fin ? 0x80 : 0) | opcode;
  const maskBit = mask ? 0x80 : 0;
  if (data.length <= 125) {
    header = Buffer.from([first, maskBit | data.length]);
  } else if (data.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = first;
    header[1] = maskBit | 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = first;
    header[1] = maskBit | 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }

  let body = data;
  if (mask) {
    body = Buffer.allocUnsafe(data.length);
    for (let i = 0; i < data.length; i += 1) body[i] = data[i] ^ key[i % 4];
  }
  return mask ? Buffer.concat([header, key, body]) : Buffer.concat([header, body]);
}

export function decodeFrames(buffer, { fromClient = true, maxPayloadBytes = 16 * 1024 * 1024 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new WebSocketCubeError('INVALID_BUFFER', 'buffer must be a Buffer');
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const start = offset;
    const b0 = buffer[offset++];
    const b1 = buffer[offset++];
    const fin = (b0 & 0x80) !== 0;
    const rsv = (b0 & 0x70) >> 4;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let length = b1 & 0x7f;

    if (rsv !== 0) throw new WebSocketCubeError('RESERVED_BITS_SET', 'reserved bits require a negotiated extension');
    if (fromClient && !masked) throw new WebSocketCubeError('CLIENT_FRAME_UNMASKED', 'client-to-server frames must be masked');
    if (!fromClient && masked) throw new WebSocketCubeError('SERVER_FRAME_MASKED', 'server-to-client frames must not be masked');

    const isControl = opcode >= 8;
    if (isControl && (!fin || length > MAX_CONTROL_PAYLOAD)) throw new WebSocketCubeError('INVALID_CONTROL_FRAME', 'invalid control frame');
    if (length === 126) {
      if (offset + 2 > buffer.length) return { frames, remainder: buffer.subarray(start) };
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (offset + 8 > buffer.length) return { frames, remainder: buffer.subarray(start) };
      const wide = buffer.readBigUInt64BE(offset);
      offset += 8;
      if (wide > BigInt(Number.MAX_SAFE_INTEGER)) throw new WebSocketCubeError('PAYLOAD_TOO_LARGE', 'payload length exceeds safe integer range');
      length = Number(wide);
    }
    if (length > maxPayloadBytes) throw new WebSocketCubeError('PAYLOAD_TOO_LARGE', `payload exceeds ${maxPayloadBytes} bytes`);

    let maskingKey = null;
    if (masked) {
      if (offset + 4 > buffer.length) return { frames, remainder: buffer.subarray(start) };
      maskingKey = buffer.subarray(offset, offset + 4);
      offset += 4;
    }
    if (offset + length > buffer.length) return { frames, remainder: buffer.subarray(start) };
    let payload = buffer.subarray(offset, offset + length);
    offset += length;
    if (maskingKey) {
      const unmasked = Buffer.allocUnsafe(length);
      for (let i = 0; i < length; i += 1) unmasked[i] = payload[i] ^ maskingKey[i % 4];
      payload = unmasked;
    } else payload = Buffer.from(payload);
    frames.push({ fin, opcode, masked, payload });
  }
  return { frames, remainder: buffer.subarray(offset) };
}

export function frameText(text, options = {}) {
  return encodeFrame({ ...options, opcode: 1, payload: text });
}

export function frameBinary(data, options = {}) {
  return encodeFrame({ ...options, opcode: 2, payload: data });
}

export function framePing(data = Buffer.alloc(0), options = {}) {
  return encodeFrame({ ...options, opcode: 9, payload: data });
}

export function framePong(data = Buffer.alloc(0), options = {}) {
  return encodeFrame({ ...options, opcode: 10, payload: data });
}

export function frameClose(code = 1000, reason = '', options = {}) {
  if (!Number.isInteger(code) || code < 1000 || code > 4999) throw new WebSocketCubeError('INVALID_CLOSE_CODE', 'invalid close code');
  const reasonBytes = Buffer.from(reason, 'utf8');
  const payload = Buffer.allocUnsafe(2 + reasonBytes.length);
  payload.writeUInt16BE(code, 0);
  reasonBytes.copy(payload, 2);
  return encodeFrame({ ...options, opcode: 8, payload });
}
