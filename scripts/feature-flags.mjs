#!/usr/bin/env node
// scripts/feature-flags.mjs
// Feature-flag contract evaluator (LaunchDarkly-style, OSS-only).
//
// This script does NOT depend on LaunchDarkly or any external service.
// It evaluates the local flag definitions against the active environment
// and emits a deterministic JSON report.
//
// Flag schema (see ci/feature-flags/flags.json):
//   {
//     "flags": [
//       {
//         "key": "experimental_canary",
//         "default": false,
//         "rules": [
//           { "when": { "env": "prod" }, "value": true },
//           { "when": { "phase": "phase2" }, "value": true }
//         ]
//       }
//     ]
//   }
//
// Rule semantics (first match wins; `default` is the fallback):
//   - `env`: exact-match against the SOVEREIGN_ENV environment variable.
//   - `phase`: exact-match against SOVEREIGN_PHASE.
//   - `cubes`: glob against cube directory names (e.g. "filesystem-*").
//   - `pr`: optional boolean — true when the workflow is running on a PR.
//
// Output:
//   .hermes/phase2/feature-flags.json — full evaluation table.
//
// This is a structural, in-process evaluator. To swap in LaunchDarkly /
// Unleash / Flagsmith later, only the rule engine changes; the contract
// schema stays.

import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

function globToRegex(g) {
  // Tiny glob: only `*` is special; everything else is literal.
  const escaped = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

function evaluateFlag(flag, ctx) {
  for (const rule of flag.rules ?? []) {
    let matched = true;
    for (const [k, v] of Object.entries(rule.when ?? {})) {
      if (k === 'cubes') {
        // value is a list of globs; any cube name matching wins.
        const globs = Array.isArray(v) ? v : [v];
        if (!globs.some(g => globToRegex(g).test(ctx.cube ?? ''))) {
          matched = false; break;
        }
      } else if (k === 'pr') {
        if (Boolean(v) !== Boolean(ctx.pr)) {
          matched = false; break;
        }
      } else if (ctx[k] !== v) {
        matched = false; break;
      }
    }
    if (matched) return {value: rule.value, matched: rule.when};
  }
  return {value: flag.default, matched: null};
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const flagsPath = resolve(REPO_ROOT, args.flags ?? 'ci/feature-flags/flags.json');
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/feature-flags.json');
  mkdirSync(dirname(outPath), {recursive: true});

  const flagsDoc = JSON.parse(readFileSync(flagsPath, 'utf8'));
  const ctx = {
    env: process.env.SOVEREIGN_ENV ?? 'dev',
    phase: process.env.SOVEREIGN_PHASE ?? 'phase2',
    pr: process.env.GITHUB_EVENT_NAME === 'pull_request',
    cube: process.env.SOVEREIGN_CUBE ?? '',
  };

  const evalRows = (flagsDoc.flags ?? []).map(f => {
    const r = evaluateFlag(f, ctx);
    return {
      key: f.key,
      default: f.default,
      value: r.value,
      matched: r.matched,
      context: ctx,
    };
  });

  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    flagsPath,
    context: ctx,
    flags: evalRows,
    summary: {
      total: evalRows.length,
      enabled: evalRows.filter(r => r.value === true).length,
      disabled: evalRows.filter(r => r.value === false).length,
    },
  };

  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  process.stdout.write(`feature-flags: ${report.summary.enabled}/${report.summary.total} enabled in env=${ctx.env} phase=${ctx.phase}\n`);
}

main();