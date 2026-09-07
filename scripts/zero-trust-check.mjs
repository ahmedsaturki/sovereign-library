#!/usr/bin/env node
// scripts/zero-trust-check.mjs
//
// Validates the Zero Trust config: every cube in the manifest
// must declare every required control.

import { parseArgsDefault as parseArgs } from './parse-args.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const args = parseArgs(process.argv.slice(2));
const outDir = resolve(args.out ?? '.hermes/phase3/zero-trust');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const config = JSON.parse(readFileSync(join(REPO_ROOT, 'architecture/zero-trust/config.json'), 'utf8'));

const required = ['authn', 'authz', 'audit_log'];
const findings = [];
for (const [cube, settings] of Object.entries(config.cubes ?? {})) {
  for (const req of required) {
    if (!settings[req]) findings.push({ cube, control: req, status: 'missing' });
  }
}

const result = {
  script: 'zero-trust-check',
  started: new Date().toISOString(),
  cubes: Object.keys(config.cubes ?? {}),
  findings,
  pass: findings.length === 0,
};
writeFileSync(join(outDir, 'zero-trust-check.transcript.json'), JSON.stringify(result, null, 2));
console.log(`zero-trust-check: ${findings.length} gaps`);
process.exit(result.pass ? 0 : 1);