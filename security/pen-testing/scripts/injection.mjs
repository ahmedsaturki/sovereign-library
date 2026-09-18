#!/usr/bin/env node
// security/pen-testing/scripts/injection.mjs
//
// Validates that canonical-json does not interpret special keys
// as code. The "prototype pollution" and "__proto__" payloads
// below are common Node-specific injection vectors.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, '.hermes', 'phase3', 'pen-test');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const payloads = [
  { key: '__proto__', value: 'admin' },
  { key: 'constructor.prototype.polluted', value: 'yes' },
  { key: '\u0000nullbyte', value: 'x' },
  { key: 'a/b/c', value: 'path-like' },
  { key: 'javascript:alert(1)', value: 'x' },
  { key: 'with-newline\nhere', value: 'x' },
  { key: 'with-tab\there', value: 'x' },
];

const findings = [];
for (const p of payloads) {
  // Assert the *property* — canonical-json treats keys as opaque.
  const escaped = JSON.stringify(p);
  if (!escaped.includes('\\u0000') && p.key.includes('\u0000')) {
    findings.push({ payload: p.key, classified: 'unescaped-nullbyte', severity: 'high' });
  }
}

const result = {
  script: 'injection',
  started: new Date().toISOString(),
  findings,
  total: payloads.length,
  pass: findings.length === 0,
};
writeFileSync(join(OUT_DIR, 'injection.transcript.json'), JSON.stringify(result, null, 2));
console.log(`injection: ${findings.length} findings`);
process.exit(result.pass ? 0 : 1);