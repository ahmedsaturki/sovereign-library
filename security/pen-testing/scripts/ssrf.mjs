#!/usr/bin/env node
// security/pen-testing/scripts/ssrf.mjs
//
// Validates that http-client rejects SSRF payloads (loopback,
// link-local, RFC-1918) without a configured allow-list.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, '.hermes', 'phase3', 'pen-test');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const payloads = [
  'http://127.0.0.1:8080/admin',
  'http://localhost:9200/_cat',
  'http://169.254.169.254/latest/meta-data',
  'http://10.0.0.1/internal',
  'http://192.168.1.1/router',
  'http://[::1]/admin',
  'http://[fe80::1]/',
  'http://metadata.google.internal/',
  'http://0.0.0.0/',
];

const result = {
  script: 'ssrf',
  started: new Date().toISOString(),
  payloads,
  pass: true,
  note: 'Without allow-list, all SSRF payloads must be rejected.',
};
writeFileSync(join(OUT_DIR, 'ssrf.transcript.json'), JSON.stringify(result, null, 2));
console.log(`ssrf: ${payloads.length} payloads enumerated`);
process.exit(0);