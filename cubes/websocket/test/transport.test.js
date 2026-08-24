import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebSocketServer, connectWebSocket } from '../src/transport.js';

test('native websocket server and client exchange text, ping and close', async () => {
  const wsServer = createWebSocketServer({ port: 0 });
  const address = await wsServer.listen();
  const url = `ws://127.0.0.1:${address.port}/socket`;
  const client = await connectWebSocket(url);

  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('message timeout')), 2000);
    wsServer.server.on('clientError', reject);
    for (const connection of wsServer.connections) {
      connection.once('message', message => {
        clearTimeout(timer);
        resolve(message);
      });
    }
  });

  client.sendText('hello');
  client.ping(Buffer.from('p'));
  const message = await received;
  assert.equal(message.text, 'hello');
  assert.equal(message.binary, false);

  const pong = new Promise(resolve => client.once('pong', resolve));
  client.ping(Buffer.from('again'));
  const pongPayload = await pong;
  assert.equal(pongPayload.toString(), 'again');

  client.close();
  await new Promise(resolve => setTimeout(resolve, 20));
  await wsServer.close();
});
