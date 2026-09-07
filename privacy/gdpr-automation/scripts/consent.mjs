#!/usr/bin/env node
// privacy/gdpr-automation/scripts/consent.mjs
//
// Records consent state per subject.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, '.hermes', 'phase3', 'gdpr');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n !== undefined && !n.startsWith('--')) { out[k] = n; i++; } else { out[k] = true; }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const subjectId = args.subject ?? 'u-001';
const state = args.state ?? 'granted';
const expiry = '2027-09-01T00:00:00.000Z';

const record = {
  subject_id: subjectId,
  consent_state: state,
  consent_ts: new Date().toISOString(),
  consent_expiry: expiry,
};

const result = {
  script: 'gdpr-consent',
  started: new Date().toISOString(),
  record,
  pass: ['granted', 'denied', 'withdrawn'].includes(state),
};
writeFileSync(join(OUT_DIR, 'consent.transcript.json'), JSON.stringify(result, null, 2));
console.log(`gdpr-consent: subject=${subjectId} state=${state}`);
process.exit(result.pass ? 0 : 1);