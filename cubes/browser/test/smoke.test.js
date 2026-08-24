import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, BrowserSession } from '../src/index.js';

function shouldRun() {
  return process.env.SOVEREIGN_BROWSER_SMOKE !== '0';
}

test('browser smoke: launch, navigate, evaluate, metadata, screenshot, cleanup', { skip: !shouldRun() }, async () => {
  const executablePath = process.env.BROWSER_EXECUTABLE || BrowserSession.findExecutable();
  assert.ok(executablePath, 'A Chromium-family executable must be available for the smoke test');

  const browser = await launch({ executablePath, headless: true, timeoutMs: 20000 });
  try {
    await browser.navigate('https://example.com');
    const metadata = await browser.metadata();
    assert.equal(metadata.url, 'https://example.com/');
    assert.equal(metadata.title, 'Example Domain');

    const bodyText = await browser.evaluate('document.body.innerText');
    assert.match(bodyText, /Example Domain/);

    const png = await browser.screenshot();
    assert.ok(Buffer.isBuffer(png));
    assert.ok(png.length > 1000, 'Screenshot should contain image data');
  } finally {
    await browser.close();
  }
});
