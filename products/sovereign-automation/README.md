# Sovereign Automation Platform — Product v0.1

## Purpose

The unified, dependency-free browser-automation product that competes directly
with Playwright/Cypress/Selenium at the workflow level. Composed entirely from
Sovereign Library cubes — no third-party runtime deps.

## What it provides (v0.1)

A single entry `@sovereign/automation`:

```js
import { automation } from '@sovereign/automation';

const sa = await automation.launch({ headless: true });
try {
  await sa.page.locator(By.role('button', { name: 'Submit' })).waitForVisible();
  await sa.expect(sa.page.locator(By.css('#email'))).toBeEnabled();
  await sa.page.locator(By.css('#email')).fill('user@example.com');
  await sa.page.locator(By.css('button')).click();
  const snap = sa.visual.capture(await sa.page.content());
  const report = sa.net.snapshot();
  await sa.recorder.saveScript();   // write the recorded steps to disk
} finally { await sa.close(); }
```

## Composed from cubes

| Concern | Cube | Status |
|---------|------|--------|
| CDP browser session | `browser` (frozen v0.1) | ready |
| Locators + auto-wait + input | `browser-interactions` (new) | implemented |
| Assertions + snapshots | `browser-assertions` (new) | implemented |
| Network interception | `browser-network-interception` (new) | implemented |
| Multi-tab | `browser-tab-manager` (new) | implemented |
| Visual DOM diff | `browser-visual-testing` (new) | implemented |
| Recorder | `browser-recorder` (new) | implemented |
| Agent orchestration | `agent-runtime` (existing) | ready |

## CLI

```
npx @sovereign/automation test <spec-file>
npx @sovereign/automation record --out recorded.json
```

## Definition of done (v0.1)

- [ ] `node --check src/index.js` clean.
- [ ] Unit tests pass (no browser; capability-injected fakes).
- [ ] CLI smoke test passes (syntax + help).
- [ ] Zero runtime third-party dependencies.
- [ ] Cross-platform (Windows/Linux/macOS/WSL).
