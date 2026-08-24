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
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}/`,
      });
    });
  });
}

test('browser smoke: launch, navigate, evaluate, metadata, screenshot, cleanup', { skip: !shouldRun() }, async () => {
  const executablePath = process.env.BROWSER_EXECUTABLE || BrowserSession.findExecutable();
  assert.ok(executablePath, 'A Chromium-family executable must be available for the smoke test');

  const fixture = await startFixtureServer();
  const browser = await launch({ executablePath, headless: true, timeoutMs: 20000 });

  try {
    await browser.navigate(fixture.url);
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
