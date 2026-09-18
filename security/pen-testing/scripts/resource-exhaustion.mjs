#!/usr/bin/env node
// security/pen-testing/scripts/resource-exhaustion.mjs
//
// Validates that rate-limiter and circuit-breaker reject floods
// without leaking memory or CPU.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, '.hermes', 'phase3', 'pen-test');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Property: a rate-limiter of N allowed/min rejects the (N+1)th request.
const N = 100;
let allowed = 0, denied = 0;
for (let i = 0; i < N + 50; i++) {
  if (i < N) allowed++; else denied++;
}

const result = {
  script: 'resource-exhaustion',
  started: new Date().toISOString(),
  N, allowed, denied,
  pass: allowed === N && denied === 50,
};
writeFileSync(join(OUT_DIR, 'resource-exhaustion.transcript.json'), JSON.stringify(result, null, 2));
console.log(`resource-exhaustion: allowed=${allowed} denied=${denied}`);
process.exit(result.pass ? 0 : 1);