# Browser Cube

A standalone browser automation product with no Puppeteer/Playwright/Selenium runtime dependency.

## What v0.1 provides

```js
import { launch } from './src/index.js';

const browser = await launch();
try {
  await browser.navigate('https://example.com');
  console.log(await browser.metadata());
  console.log(await browser.evaluate('document.body.innerText'));
  await (await import('node:fs/promises')).writeFile('example.png', await browser.screenshot());
} finally {
  await browser.close();
}
```

The implementation talks to a Chromium-family browser through Chrome DevTools Protocol and uses Node.js built-ins only.

## Scope discipline

This cube is intentionally not trying to be a complete Playwright clone in its first release. Navigation, evaluation, metadata, screenshot, lifecycle, cleanup, and deterministic errors are the finished v0.1 slice. Selectors, input, downloads, uploads, network control, multiple contexts, and other capabilities are separate future slices with their own completion gates.

## Security boundary

This is a general browser runtime. It does not implement CAPTCHA solving, anti-bot bypass, credential theft, stealth evasion, or unauthorized account automation.
