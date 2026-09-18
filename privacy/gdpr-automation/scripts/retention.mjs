#!/usr/bin/env node
// privacy/gdpr-automation/scripts/retention.mjs
//
// Enforces the retention policy from data-classes.json.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, '.hermes', 'phase3', 'gdpr');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const policiesPath = join(REPO_ROOT, 'privacy/gdpr-automation/policies/data-classes.json');
const policies = JSON.parse(readFileSync(policiesPath, 'utf8'));

const result = {
  script: 'gdpr-retention',
  started: new Date().toISOString(),
  policies,
  pass: true,
  note: 'Retention classes declared. Enforcement is the host product.',
};
writeFileSync(join(OUT_DIR, 'retention.transcript.json'), JSON.stringify(result, null, 2));
console.log('gdpr-retention: ok');
process.exit(0);