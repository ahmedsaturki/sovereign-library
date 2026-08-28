# Browser Cube v0.1

A standalone native browser automation product with no Puppeteer/Playwright/Selenium runtime dependency.

## Release status

**v0.1 RELEASED** after GitHub Actions verification on Windows, Linux, and macOS with a real Chromium smoke test.

## What v0.1 provides

```js
import { launch } from './src/index.js';

const browser = await launch();
try {
  await browser.navigate('http://127.0.0.1:3000/');
  console.log(await browser.metadata());
  console.log(await browser.evaluate('document.body.innerText'));
  const image = await browser.screenshot();
} finally {
  await browser.close();
}
```

The implementation talks to a Chromium-family browser through Chrome DevTools Protocol and uses Node.js built-ins only.

## Scope

v0.1 is intentionally a finished slice, not a partial Playwright clone. The released slice covers launch/session lifecycle, CDP connection, target attachment, navigation, page evaluation, metadata, screenshot, deterministic errors, and cleanup.

Selectors, user input, downloads, uploads, network control, multiple contexts, cookies/storage APIs, and other capabilities are separate future slices with their own completion gates.

## Security boundary

This is a general browser runtime. It does not implement CAPTCHA solving, anti-bot bypass, credential theft, stealth evasion, or unauthorized account automation.
