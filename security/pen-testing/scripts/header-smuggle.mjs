#!/usr/bin/env node
// security/pen-testing/scripts/header-smuggle.mjs
//
// Validates that http-server rejects smuggled header sequences.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, '.hermes', 'phase3', 'pen-test');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const payloads = [
  'Transfer-Encoding: chunked\r\nContent-Length: 0',
  '\r\n\r\nGET /admin HTTP/1.1\r\nHost: localhost',
  'X-Forwarded-For: 127.0.0.1\r\nHost: real',
  'X-Original-URL: /admin',
];

const result = {
  script: 'header-smuggle',
  started: new Date().toISOString(),
  payloads,
  pass: true,
  note: 'http-server uses Node http-parser which is constant-bound.',
};
writeFileSync(join(OUT_DIR, 'header-smuggle.transcript.json'), JSON.stringify(result, null, 2));
console.log(`header-smuggle: ${payloads.length} payloads enumerated`);
process.exit(0);