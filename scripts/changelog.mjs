#!/usr/bin/env node
// scripts/changelog.mjs
// Generate a changelog preview by parsing the recent git log between two
// refs and bucketing them into Conventional-Commit-style groups.
// Output is markdown that can be pasted into CHANGELOG.md.
//
// Usage:
//   node scripts/changelog.mjs --since HEAD~50 --until HEAD --out .hermes/phase2/changelog.md

import {execFileSync} from 'node:child_process';
import {writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

function gitLog(since, until) {
  // We accept either a date (e.g. "2026-08-01") or a git ref (e.g.
  // "HEAD~500"). When a ref is given we translate it via `git rev-parse`
  // to an explicit SHA so the format `--since=<SHA>` is unambiguous.
  // `git log --since=<SHA>` actually filters by date, which is not what
  // we want, so we use `<since>..<until>` as a rev range instead.
  const sinceSha = isLikelyRef(since) ? safeExec('git', ['rev-parse', since]) : since;
  const untilSha = isLikelyRef(until) ? safeExec('git', ['rev-parse', until]) : until;
  const range = `${sinceSha}..${untilSha}`;
  const fmt = '%x1e%H%x1f%an%x1f%ad%x1f%s%x1f%b';
  const out = execFileSync('git', ['log', range, '--date=iso-strict', `--format=${fmt}`], {cwd: REPO_ROOT, encoding: 'utf8'});
  return out;
}

function isLikelyRef(s) {
  return typeof s === 'string' && /^[A-Za-z0-9_.^~/-]+$/.test(s) && !/^\d{4}-\d{2}-\d{2}/.test(s);
}

function safeExec(cmd, args) {
  try { return execFileSync(cmd, args, {cwd: REPO_ROOT, encoding: 'utf8'}).trim(); }
  catch { return ''; }
}

function classify(subject) {
  // Conventional-commit bucket.
  const m = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?:\s*/i.exec(subject);
  if (!m) return {type: 'other', scope: '', bang: false};
  return {type: m.groups.type.toLowerCase(), scope: m.groups.scope ?? '', bang: Boolean(m.groups.bang)};
}


function main() {
  const args = parseArgs(process.argv.slice(2));
  const since = args.since ?? 'HEAD~50';
  const until = args.until ?? 'HEAD';
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/changelog.md');
  mkdirSync(dirname(outPath), {recursive: true});

  const log = gitLog(since, until);
  const commits = log.split('\x1e').map(block => block.trim()).filter(Boolean).map(block => {
    const [hash, author, date, subject, body] = block.split('\x1f');
    return {hash, author, date, subject, body};
  });

  const buckets = new Map();
  for (const c of commits) {
    const {type, scope, bang} = classify(c.subject);
    const key = bang ? `${type}!` : type;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({...c, scope});
  }

  const lines = [];
  lines.push(`# Changelog (preview: ${since}..${until})`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  const order = ['feat!', 'feat', 'fix!', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore', 'other'];
  for (const key of order) {
    const items = buckets.get(key);
    if (!items?.length) continue;
    lines.push(`## ${key} (${items.length})`);
    for (const it of items) {
      const scope = it.scope ? `**${it.scope}**: ` : '';
      lines.push(`- ${scope}${it.subject} (${it.hash.slice(0, 7)})`);
    }
    lines.push('');
  }
  const md = lines.join('\n');
  writeFileSync(outPath, md, 'utf8');
  process.stdout.write(`changelog: ${commits.length} commits -> ${outPath}\n`);
}

main();