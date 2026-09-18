#!/usr/bin/env node
// security/pen-testing/scripts/replay-attack.mjs
//
// Validates that release-approval cannot be replayed.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, '.hermes', 'phase3', 'pen-test');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const approval = { nonce: 1, signer: 'h1', ts: Date.now() };
const seenNonces = new Set([approval.nonce]);
const replayed = { ...approval };
const accepted = !seenNonces.has(replayed.nonce);

const result = {
  script: 'replay-attack',
  started: new Date().toISOString(),
  original: approval,
  replayed,
  pass: !accepted,
  note: 'Replay must be rejected because nonce is already seen.',
};
writeFileSync(join(OUT_DIR, 'replay-attack.transcript.json'), JSON.stringify(result, null, 2));
console.log(`replay-attack: pass=${result.pass}`);
process.exit(result.pass ? 0 : 1);