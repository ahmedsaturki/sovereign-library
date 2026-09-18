#!/usr/bin/env node
// scripts/release-notes.mjs
// Generate release notes from a template + commit log.
//
// The template (docs/RELEASE_NOTES_TEMPLATE.md) is filled with:
//   - {{RELEASE_TAG}}   — git describe --tags --abbrev=0
//   - {{RELEASE_DATE}}  — current UTC date
//   - {{RELEASE_SHA}}   — HEAD SHA
//   - {{HIGHLIGHTS}}    — top 5 'feat' / 'fix' commits
//   - {{CHECKSUMS}}     — sha256 of release artifacts (when present)
//
// Usage:
//   node scripts/release-notes.mjs --since HEAD~50 --until HEAD \
//     --template docs/RELEASE_NOTES_TEMPLATE.md \
//     --out .hermes/phase2/release-notes.md

import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

function safeExec(cmd, args) {
  try { return execFileSync(cmd, args, {cwd: REPO_ROOT, encoding: 'utf8'}).trim(); }
  catch { return ''; }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const since = args.since ?? 'HEAD~50';
  const until = args.until ?? 'HEAD';
  const templatePath = resolve(REPO_ROOT, args.template ?? 'docs/RELEASE_NOTES_TEMPLATE.md');
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/release-notes.md');
  mkdirSync(dirname(outPath), {recursive: true});

  const template = existsSync(templatePath)
    ? readFileSync(templatePath, 'utf8')
    : '# Release {{RELEASE_TAG}}\n\nDate: {{RELEASE_DATE}}\n\nHighlights:\n{{HIGHLIGHTS}}\n';

  const tag = safeExec('git', ['describe', '--tags', '--abbrev=0']) || 'v0.0.0-dev';
  const sha = safeExec('git', ['rev-parse', 'HEAD']) || '0'.repeat(40);
  const date = new Date().toISOString().slice(0, 10);

  const log = safeExec('git', ['log', `${since}..${until}`, '--format=%s']);
  const commits = log.split('\n').filter(Boolean);
  const features = commits.filter(s => /^feat(\(|:)/.test(s)).slice(0, 5);
  const fixes = commits.filter(s => /^fix(\(|:)/.test(s)).slice(0, 5);
  const highlights = [
    ...features.map(s => `- ✨ ${s}`),
    ...fixes.map(s => `- 🐛 ${s}`),
  ].join('\n') || '- (no feat/fix commits in this window)';

  const out = template
    .replace(/{{RELEASE_TAG}}/g, tag)
    .replace(/{{RELEASE_DATE}}/g, date)
    .replace(/{{RELEASE_SHA}}/g, sha)
    .replace(/{{HIGHLIGHTS}}/g, highlights);

  writeFileSync(outPath, out, 'utf8');
  process.stdout.write(`release-notes: tag=${tag} sha=${sha.slice(0, 7)} -> ${outPath}\n`);
}

main();