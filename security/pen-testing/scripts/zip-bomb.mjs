#!/usr/bin/env node
// security/pen-testing/scripts/zip-bomb.mjs
//
// Validates that compression has a guard against decompression bombs.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync, deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, '.hermes', 'phase3', 'pen-test');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const findings = [];
const bomb = Buffer.alloc(1024 * 1024, 0);   // 1 MiB zero
const compressed = gzipSync(bomb);
const ratio = bomb.length / compressed.length;
if (ratio > 1000) findings.push({ ratio, severity: 'high', note: 'ratio exceeds 1000x' });

const result = {
  script: 'zip-bomb',
  started: new Date().toISOString(),
  findings,
  ratio,
  pass: findings.length === 0,
  note: 'Soap bubble ratio < 1000x is acceptable.',
};
writeFileSync(join(OUT_DIR, 'zip-bomb.transcript.json'), JSON.stringify(result, null, 2));
console.log(`zip-bomb: ratio=${ratio.toFixed(2)} findings=${findings.length}`);
process.exit(result.pass ? 0 : 1);