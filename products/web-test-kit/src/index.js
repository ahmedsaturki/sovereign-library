// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check

/**
 * Web Test Kit — a composable product façade over Sovereign cubes.
 *
 *   browser (CDP)  +  browser-interactions (locators/actions)
 *                   +  browser-assertions (expect/snapshot)
 *
 * Zero third-party dependencies. Every layer remains independently usable;
 * this file only wires them together so a single import runs a full test.
 */

import { BrowserSession, launch } from '#browser';
import { BrowserInteractions, By } from '#browser-interactions';
import { expect, Snapshot, AssertionsError } from '#browser-assertions';
import { BrowserRecorder } from '#browser-recorder';

export { By, expect, Snapshot, AssertionsError, BrowserInteractions, BrowserSession, launch, BrowserRecorder };

/**
 * One object that owns the browser session and exposes the full testing API.
 * Built from the cubes; nothing bespoke, nothing extra.
 */
export class WebTestKit {
  constructor(session, options = {}) {
    if (!session || typeof session.evaluate !== 'function') {
      throw new AssertionsError('INVALID_SESSION', 'WebTestKit requires a session with an evaluate() method');
    }
    this.session = session;
    this.page = new BrowserInteractions(session, options);
    this.snapshot = new Snapshot();
  }

  static async launch(options = {}) {
    const session = await launch(options);
    return new WebTestKit(session, options);
  }

  locator(strategy, options) { return this.page.locator(strategy, options); }
  css(selector, options) { return this.page.css(selector, options); }
  expect(locator, options) { return expect(locator, options); }
  snapshotOf(html) { return this.snapshot.capture(html); }
  diffSnapshots(before, after) { return this.snapshot.diff(before, after); }
  recorder() { return new BrowserRecorder(this.page); }

  async title() { return this.page.title(); }
  async url() { return this.page.url(); }
  async content() { return this.page.content(); }
  async close() { return this.session.close(); }
}

export default WebTestKit;
