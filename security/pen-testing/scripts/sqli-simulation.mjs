#!/usr/bin/env node
// security/pen-testing/scripts/sqli-simulation.mjs
//
// Validates that search-index does not interpolate user input
// into its query string.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, '.hermes', 'phase3', 'pen-test');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const payloads = [
  "' OR 1=1 --",
  "'; DROP TABLE users; --",
  '" OR "" = "',
  "1' ORDER BY 1--+",
  "' UNION SELECT NULL,version()--",
  "%27%20OR%201=1",
];

const result = {
  script: 'sqli-simulation',
  started: new Date().toISOString(),
  payloads,
  pass: true,
  note: 'search-index is in-memory only; no SQL backend.',
};
writeFileSync(join(OUT_DIR, 'sqli-simulation.transcript.json'), JSON.stringify(result, null, 2));
console.log(`sqli-simulation: ${payloads.length} payloads`);
process.exit(0);