// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { launch, BrowserSession } from '../../browser/src/index.js';
import { NetworkInterceptor } from '../../browser-network-interception/src/index.js';

// Adapt the browser cube's CdpConnection (on/command) to the NetworkInterceptor
// contract (on/send). The interceptor is capability-injectable; the real CDP
// `command` is the send primitive.
function adaptCdp(cdp) {
  return {
    on: (method, handler) => cdp.on(method, handler),
    send: (method, params) => cdp.command(method, params),
  };
}

function shouldRun() {
  return process.env.SOVEREIGN_BROWSER_SMOKE !== '0';
}

function startFixtureServer() {
  const server = createServer((request, response) => {
    if (request.url === '/api/real') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, source: 'real-server' }));
      return;
    }
    if (request.url === '/api/blocked') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, source: 'should-never-reach' }));
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, base: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function closeFixtureServer(server) {
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

// Real-browser network interception smoke. Verifies the cube's Fetch-domain flow
// actually intercepts requests in Chromium: a blocked route fails, a pass-through
// route reaches the real server. No external network. Gated behind the same flag
// as the browser smoke test.
test('real browser: NetworkInterceptor blocks a route and passes through the rest', { skip: !shouldRun(), timeout: 30000 }, async () => {
  const executablePath = process.env.BROWSER_EXECUTABLE || BrowserSession.findExecutable();
  assert.ok(executablePath, 'A Chromium-family executable must be available for the network smoke test');

  const fixture = await startFixtureServer();
  let browser;
  let net;
  try {
    browser = await launch({ executablePath, headless: true, timeoutMs: 20000 });
    net = new NetworkInterceptor(adaptCdp(browser.cdp));
    await net.enable();
    await net.addRoute({ pattern: '**/api/blocked', action: 'block' });

    // Navigate to a real page served by the in-process fixture server.
    await browser.navigate(`${fixture.base}/`);
    await browser.evaluate('1'); // ensure runtime ready

    const blocked = await browser.evaluate(`(async () => {
      try {
        const r = await fetch('${fixture.base}/api/blocked');
        return { ok: r.ok, status: r.status };
      } catch (e) { return { error: String(e) }; }
    })()`);
    assert.ok(blocked.error, `blocked route must fail in-browser, got ${JSON.stringify(blocked)}`);

    const passthrough = await browser.evaluate(`(async () => {
      try {
        const r = await fetch('${fixture.base}/api/real');
        return { ok: r.ok, status: r.status, body: await r.json() };
      } catch (e) { return { error: String(e) }; }
    })()`);
    assert.ok(passthrough.ok, `pass-through route must reach real server, got ${JSON.stringify(passthrough)}`);
    assert.equal(passthrough.body.source, 'real-server');

    // Traffic log reflects the blocked + pass-through requests.
    const snap = net.snapshot();
    const blockedLogged = snap.find(s => s.url.endsWith('/api/blocked'));
    const realLogged = snap.find(s => s.url.endsWith('/api/real'));
    assert.ok(blockedLogged, 'blocked request must appear in traffic log');
    assert.ok(realLogged, 'pass-through request must appear in traffic log');
    // v0.1 does not capture real response bodies.
    assert.equal(blockedLogged.body, null);
    assert.equal(realLogged.body, null);
  } finally {
    if (net) await net.destroy().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await closeFixtureServer(fixture.server);
  }
});
