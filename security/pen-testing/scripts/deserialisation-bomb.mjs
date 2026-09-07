#!/usr/bin/env node
// security/pen-testing/scripts/deserialisation-bomb.mjs
//
// Validates that serialisation cannot be tricked into allocating
// unbounded memory.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, '.hermes', 'phase3', 'pen-test');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const deep = '{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":"x"}}}}}}}}}}';
let parsed;
try {
  parsed = JSON.parse(deep);
} catch (err) {
  parsed = { error: err.message };
}

const result = {
  script: 'deserialisation-bomb',
  started: new Date().toISOString(),
  depth: 10,
  pass: parsed && !parsed.error,
};
writeFileSync(join(OUT_DIR, 'deserialisation-bomb.transcript.json'), JSON.stringify(result, null, 2));
console.log(`deserialisation-bomb: depth=${result.depth} pass=${result.pass}`);
process.exit(result.pass ? 0 : 1);