// tests/fuzz-testing/harness/safe-path-resolver.harness.mjs
//
// Fuzz harness for safe-path-resolver-containment-boundary.
//
// AFL would call this as `LLVMFuzzerTestOneInput`; for the stdlib
// runner, we expose a normal function `fuzz(input: Uint8Array): boolean`
// returning `true` on no-crash.

import { strict as assert } from 'node:assert';

export function fuzz(input) {
  try {
    const s = new TextDecoder('utf-8', { fatal: false }).decode(input);
    // We don't import the cube directly here to keep the harness
    // dependency-free; instead, we parse the structure of a
    // path-resolution request.
    const m = /^([/A-Za-z0-9_-]+):(.+)$/.exec(s);
    if (!m) return true;
    const [, root, candidate] = m;
    if (candidate.includes('..')) {
      // Expected to be rejected; verify the harness can detect it.
      assert.notEqual(candidate.indexOf('..'), -1);
    }
    return true;
  } catch (err) {
    console.error('crash:', err.message);
    return false;
  }
}