import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebSocketServer, connectWebSocket } from '../src/transport.js';

function waitForEvent(emitter, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timeout`)), timeoutMs);
    const onEvent = (...args) => {
      clearTimeout(timer);
      resolve(args.length <= 1 ? args[0] : args);
    };
    emitter.once(event, onEvent);
  });
}

test('native websocket server and client exchange text, ping and close', async () => {
  const wsServer = createWebSocketServer({ port: 0 });
  let client = null;
  try {
    const address = await wsServer.listen();
    const url = `ws://127.0.0.1:${address.port}/socket`;
    client = await connectWebSocket(url, { timeoutMs: 2000 });

    const connection = [...wsServer.connections][0];
    assert.ok(connection, 'server connection should exist after handshake');

    const received = waitForEvent(connection, 'message');
    client.sendText('hello');
    const message = await received;
    assert.equal(message.text, 'hello');
    assert.equal(message.binary, false);

    const pong = waitForEvent(client, 'pong');
    client.ping(Buffer.from('again'));
    const pongPayload = await pong;
    assert.equal(pongPayload.toString(), 'again');

    const serverClose = waitForEvent(connection, 'closeFrame');
    client.close();
    await serverClose;
  } finally {
    if (client?.socket && !client.closed) client.socket.destroy();
    for (const connection of wsServer.connections) connection.socket.destroy();
    await new Promise(resolve => wsServer.server.close(() => resolve()));
  }
});
