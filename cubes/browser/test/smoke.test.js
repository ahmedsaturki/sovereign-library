import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { launch, BrowserSession } from '../src/index.js';

function shouldRun() {
  return process.env.SOVEREIGN_BROWSER_SMOKE !== '0';
}

function startFixtureServer() {
  const server = createServer((request, response) => {
    if (request.url !== '/') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html>
<html lang="en">
  <head><title>Sovereign Browser Fixture</title></head>
  <body><main id="root">Sovereign Browser Cube OK</main></body>
</html>`);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.equal(typeof address, 'object');
      resolve({ server, url: `http://127.0.0.1:${address.port}/` });
    });
  });
}

async function waitForPageReady(browser, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const readyState = await browser.evaluate('document.readyState');
    if (readyState === 'complete') return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Browser fixture did not reach readyState=complete');
}

test('browser smoke: launch, navigate, evaluate, metadata, screenshot, cleanup', { skip: !shouldRun(), timeout: 30000 }, async () => {
  const executablePath = process.env.BROWSER_EXECUTABLE || BrowserSession.findExecutable();
  assert.ok(executablePath, 'A Chromium-family executable must be available for the smoke test');

  const fixture = await startFixtureServer();
  const browser = await launch({ executablePath, headless: true, timeoutMs: 20000 });

  try {
    await browser.navigate(fixture.url);
    await waitForPageReady(browser);

    const metadata = await browser.metadata();
    assert.equal(metadata.url, fixture.url);
    assert.equal(metadata.title, 'Sovereign Browser Fixture');
    assert.equal(metadata.readyState, 'complete');

    const bodyText = await browser.evaluate('document.body.innerText');
    assert.match(bodyText, /Sovereign Browser Cube OK/);

    const png = await browser.screenshot();
    assert.ok(Buffer.isBuffer(png));
    assert.ok(png.length > 1000, 'Screenshot should contain image data');
    assert.equal(browser.closed, false);
  } finally {
    await browser.close();
    await new Promise(resolve => fixture.server.close(resolve));
  }

  assert.equal(browser.closed, true);
  assert.equal(browser.process, null);
});
