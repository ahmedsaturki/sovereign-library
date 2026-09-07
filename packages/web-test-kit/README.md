# Web Test Kit (Product)

A standalone, dependency-free web testing product composed entirely from
Sovereign Library cubes:

- `browser` — native CDP session (no Puppeteer/Playwright/Selenium)
- `browser-interactions` — locators, auto-wait, input simulation
- `browser-assertions` — auto-retrying assertions + snapshot diffing

Zero runtime third-party dependencies. Each cube remains independently usable;
this product is a thin, composable façade that wires them together so a user can
run a full browser test with one import.

## Why

Playwright/Cypress are heavy and opinionated. Sovereign Web Test Kit gives you
the same ergonomics (locate → act → assert → snapshot) with:
- zero supply-chain surface (only `node:` + the browser),
- deterministic, classified errors,
- bounded retries, and
- the ability to take any single cube and reuse it in another product.
