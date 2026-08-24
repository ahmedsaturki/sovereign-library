import { createServer as createHttpServer } from 'node:http';
import { connect as connectNet } from 'node:net';
import { connect as connectTls } from 'node:tls';
import { URL } from 'node:url';
import { EventEmitter } from 'node:events';
import { createAcceptKey, createClientKey, decodeFrames, encodeFrame, frameClose, framePing, framePong, frameText, frameBinary, WebSocketCubeError } from './index.js';

function headersToMap(raw) {
  const map = new Map();
  for (const line of raw.split(/\r\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    map.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
  }
  return map;
}

function validUpgradeHeaders(headers) {
  return headers.get('upgrade')?.toLowerCase() === 'websocket'
    && headers.get('connection')?.toLowerCase().split(/\s*,\s*/).includes('upgrade')
    && headers.get('sec-websocket-version') === '13'
    && typeof headers.get('sec-websocket-key') === 'string';
}

export class WebSocketConnection extends EventEmitter {
  constructor(socket, { serverSide = false, maxPayloadBytes = 16 * 1024 * 1024 } = {}) {
    super();
    this.socket = socket;
    this.serverSide = serverSide;
    this.maxPayloadBytes = maxPayloadBytes;
    this.closed = false;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentOpcode = null;
    socket.on('data', chunk => this.#onData(Buffer.from(chunk)));
    socket.on('error', error => this.emit('error', error));
    socket.on('close', () => {
      this.closed = true;
      this.emit('close');
    });
  }

  get writable() { return !this.closed && this.socket.writable; }

  sendText(value) { this.#write(frameText(value, { mask: !this.serverSide })); }
  sendBinary(value) { this.#write(frameBinary(value, { mask: !this.serverSide })); }
  ping(value = Buffer.alloc(0)) { this.#write(framePing(value, { mask: !this.serverSide })); }
  pong(value = Buffer.alloc(0)) { this.#write(framePong(value, { mask: !this.serverSide })); }
  close(code = 1000, reason = '') {
    if (this.closed) return;
    this.#write(frameClose(code, reason, { mask: !this.serverSide }));
    this.socket.end();
  }

  #write(frame) {
    if (!this.writable) throw new WebSocketCubeError('CONNECTION_CLOSED', 'WebSocket connection is closed');
    if (!this.socket.write(frame)) this.emit('backpressure');
  }

  #onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    try {
      const decoded = decodeFrames(this.buffer, { fromClient: this.serverSide, maxPayloadBytes: this.maxPayloadBytes });
      this.buffer = decoded.remainder;
      for (const frame of decoded.frames) this.#handleFrame(frame);
    } catch (error) {
      this.emit('error', error);
      this.close(1002, error instanceof Error ? error.message.slice(0, 80) : 'protocol error');
    }
  }

  #handleFrame(frame) {
    if (frame.opcode === 0) {
      if (this.fragmentOpcode == null) throw new WebSocketCubeError('UNEXPECTED_CONTINUATION', 'continuation without fragmented message');
      this.fragments.push(frame.payload);
      if (frame.fin) {
        const payload = Buffer.concat(this.fragments);
        const opcode = this.fragmentOpcode;
        this.fragments = [];
        this.fragmentOpcode = null;
        this.emit('message', { opcode, payload, text: opcode === 1 ? payload.toString('utf8') : null, binary: opcode === 2 });
      }
      return;
    }
    if ((frame.opcode === 1 || frame.opcode === 2) && !frame.fin) {
      if (this.fragmentOpcode != null) throw new WebSocketCubeError('NESTED_FRAGMENT', 'nested fragmented message');
      this.fragmentOpcode = frame.opcode;
      this.fragments = [frame.payload];
      return;
    }
    if (frame.opcode === 1 || frame.opcode === 2) {
      this.emit('message', { opcode: frame.opcode, payload: frame.payload, text: frame.opcode === 1 ? frame.payload.toString('utf8') : null, binary: frame.opcode === 2 });
      return;
    }
    if (frame.opcode === 8) {
      this.emit('closeFrame', frame.payload);
      if (!this.closed) {
        this.#write(frameClose(1000, '', { mask: !this.serverSide }));
        this.socket.end();
      }
    } else if (frame.opcode === 9) {
      this.emit('ping', frame.payload);
      this.pong(frame.payload);
    } else if (frame.opcode === 10) this.emit('pong', frame.payload);
    else throw new WebSocketCubeError('UNSUPPORTED_OPCODE', `unsupported opcode ${frame.opcode}`);
  }
}

export function attachUpgrade(request, socket, head, options = {}) {
  const rawHeaders = [
    `GET ${request.url} HTTP/1.1`,
    ...Object.entries(request.headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(',') : v}`),
  ].join('\r\n');
  const headers = headersToMap(rawHeaders);
  if (!validUpgradeHeaders(headers)) {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    socket.destroy();
    throw new WebSocketCubeError('INVALID_HANDSHAKE', 'invalid WebSocket upgrade request');
  }
  const accept = createAcceptKey(headers.get('sec-websocket-key'));
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const connection = new WebSocketConnection(socket, { ...options, serverSide: true });
  if (head?.length) connection.emit('data', head);
  return connection;
}

export function createWebSocketServer({ port = 0, host = '127.0.0.1', maxPayloadBytes } = {}) {
  const server = createHttpServer();
  const connections = new Set();
  server.on('upgrade', (request, socket, head) => {
    try {
      const connection = attachUpgrade(request, socket, head, { maxPayloadBytes });
      connections.add(connection);
      connection.once('close', () => connections.delete(connection));
    } catch (error) {
      server.emit('clientError', error);
    }
  });
  return {
    server,
    connections,
    listen() { return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server.address())); }); },
    close() { for (const connection of connections) connection.close(1001, 'server shutdown'); return new Promise(resolve => server.close(resolve)); },
  };
}

export function connectWebSocket(urlString, { timeoutMs = 10_000, headers = {}, maxPayloadBytes, protocol = '' } = {}) {
  const target = new URL(urlString);
  if (!['ws:', 'wss:'].includes(target.protocol)) return Promise.reject(new WebSocketCubeError('INVALID_URL', 'WebSocket URL must use ws or wss'));
  const port = Number(target.port) || (target.protocol === 'wss:' ? 443 : 80);
  const host = target.hostname;
  const key = createClientKey();
  const path = `${target.pathname || '/'}${target.search}`;
  const socketOptions = { host, port, servername: host };
  const socket = target.protocol === 'wss:' ? connectTls(socketOptions) : connectNet({ host, port });
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { socket.destroy(); reject(new WebSocketCubeError('TIMEOUT', `WebSocket handshake exceeded ${timeoutMs}ms`, { retryable: true })); }, timeoutMs);
    socket.once('error', error => { if (!settled) { clearTimeout(timer); reject(new WebSocketCubeError('CONNECT_FAILED', error.message, { cause: error, retryable: true })); } });
    socket.once('connect', () => {
      const lines = [`GET ${path} HTTP/1.1`, `Host: ${host}${target.port ? `:${target.port}` : ''}`, 'Upgrade: websocket', 'Connection: Upgrade', 'Sec-WebSocket-Version: 13', `Sec-WebSocket-Key: ${key}`];
      if (protocol) lines.push(`Sec-WebSocket-Protocol: ${protocol}`);
      for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
      lines.push('', '');
      socket.write(lines.join('\r\n'));
    });
    let buffer = Buffer.alloc(0);
    const onHandshake = chunk => {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
      const marker = buffer.indexOf('\r\n\r\n');
      if (marker === -1) return;
      socket.off('data', onHandshake);
      const headerBlock = buffer.subarray(0, marker).toString('utf8');
      const [statusLine, ...headerLines] = headerBlock.split('\r\n');
      const responseHeaders = headersToMap(headerLines.join('\r\n'));
      if (!/^HTTP\/1\.1 101 /.test(statusLine) || responseHeaders.get('sec-websocket-accept') !== createAcceptKey(key)) {
        clearTimeout(timer);
        socket.destroy();
        reject(new WebSocketCubeError('HANDSHAKE_FAILED', 'server rejected WebSocket handshake'));
        return;
      }
      settled = true;
      clearTimeout(timer);
      const connection = new WebSocketConnection(socket, { maxPayloadBytes, serverSide: false });
      const remainder = buffer.subarray(marker + 4);
      if (remainder.length) connection.socket.emit('data', remainder);
      resolve(connection);
    };
    socket.on('data', onHandshake);
  });
}
