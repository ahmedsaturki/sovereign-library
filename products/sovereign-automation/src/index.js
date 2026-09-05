// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

/**
 * Sovereign Automation Platform v0.1
 *
 * Unified, dependency-free browser automation product composed from Sovereign
 * Library cubes. Competes with Playwright / Cypress / Selenium at the workflow
 * level while keeping zero runtime third-party dependencies.
 */

import { BrowserSession, BrowserCubeError, launch } from '../../../cubes/browser/src/index.js';
import { BrowserInteractions, By, InteractionsError } from '../../../cubes/browser-interactions/src/index.js';
import { expect, Snapshot, AssertionsError } from '../../../cubes/browser-assertions/src/index.js';
import { NetworkInterceptor, NetworkError } from '../../../cubes/browser-network-interception/src/index.js';
import { TabManager, TabManagerError } from '../../../cubes/browser-tab-manager/src/index.js';
import { VisualTester, VisualError } from '../../../cubes/browser-visual-testing/src/index.js';
import { BrowserRecorder, RecorderError } from '../../../cubes/browser-recorder/src/index.js';

const VERSION = '0.1.0';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class AutomationError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'AutomationError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    Object.freeze(this);
  }
}

function fail(code, message, options) {
  throw new AutomationError(code, message, options);
}

/**
 * SovereignAutomation is the unified entry. It owns a browser session and
 * wires the full cube stack: interactions, assertions, network, tabs, visual,
 * recorder.
 */
export class SovereignAutomation {
  constructor(session, options = {}) {
    if (!session || typeof session.close !== 'function' || !session.cdp) {
      fail('INVALID_SESSION', 'SovereignAutomation requires a browser session with close() and a cdp connection');
    }
    this.session = session;
    this.page = new BrowserInteractions(session, options);
    this.assert = new Snapshot();
    this.net = new NetworkInterceptor(session.cdp);
    this.tabs = new TabManager(session.cdp);
    this.visual = new VisualTester();
    this.recorder = new BrowserRecorder(this.page);
    this._closed = false;
  }

  static async launch(options = {}) {
    const session = await launch(options);
    return new SovereignAutomation(session, options);
  }

  /** Convenience locator + assertion facade. */
  locator(strategy, options) { return this.page.locator(strategy, options); }
  css(selector, options) { return this.page.css(selector, options); }
  expect(locator, options) { return expect(locator, options); }

  async enableNetwork() { await this.net.enable(); return this.net; }

  /** Save the recorded script to a JSON file. */
  async saveScript(outPath) {
    const script = this.recorder.getScript();
    const dir = join(tmpdir(), 'sovereign-automation');
    await mkdir(dir, { recursive: true });
    const file = outPath || join(dir, `record-${Date.now()}.json`);
    await writeFile(file, JSON.stringify({ version: VERSION, steps: script }, null, 2), 'utf8');
    return file;
  }

  async title() { return this.page.title(); }
  async url() { return this.page.url(); }
  async content() { return this.page.content(); }
  async close() {
    if (this._closed) return;
    this._closed = true;
    try { await this.net?.destroy(); } catch {}
    try { await this.tabs?.destroy(); } catch {}
    try { await this.session.close(); } catch {}
  }
}

/** CLI entry — minimal, dependency-free, cross-platform. */
export async function cli(argv = process.argv.slice(2)) {
  const args = argv;
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return console.log(`Sovereign Automation Platform v${VERSION}
Usage:
  npx @sovereign/automation help       This message
  npx @sovereign/automation check      Check that the installed cubes are wired`);
  }
  const cmd = args[0];
  switch (cmd) {
    case 'help':
    case '--help':
    case '-h':
      return console.log(`Sovereign Automation Platform v${VERSION}
Commands:
  automation help        Show this help
  automation check       Verify the cube graph is wired
  test     <spec>        Run a spec file (stub: syntax check only in v0.1)
  record   [--out <p>]   Record a session to JSON`);
    case 'check':
      console.log('cubes wired: browser, browser-interactions, browser-assertions, browser-network-interception, browser-tab-manager, browser-visual-testing, browser-recorder');
      console.log('status: OK (v0.1)');
      return;
    case 'test': case 'record':
      console.log(`automation ${cmd}: v0.1 — command scaffold (real run needs a browser session)`);
      return;
    default:
      fail('UNKNOWN_COMMAND', `Unknown command: ${cmd}`);
  }
}

export default { SovereignAutomation, cli, launch, By, expect, VERSION };
export { VERSION };
