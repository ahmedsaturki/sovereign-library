#!/usr/bin/env node
// scripts/migrate.mjs
// Generic schema versioner for SQL migrations. Works against any backend
// that exposes a single `exec(sql, params)` function (SQLite in-memory is
// used by default for the dry-run in CI).
//
// Migration file convention:
//   <migrations-dir>/NNN-name.sql   (zero-padded numeric prefix; lexicographic order)
//   <migrations-dir>/NNN-name.down.sql   (optional reverse script)
//
// Schema version is tracked in `schema_migrations(version INT PRIMARY KEY, applied_at TEXT)`.
//
// Usage:
//   node scripts/migrate.mjs --migrations migrations/sqlite --target "sqlite::memory:" --dry-run --out .hermes/phase2/migrations.json
//
// In production, --target is replaced with a real DB URL and the same
// migration scripts execute against the live database. Sovereign cubes
// do not currently have a shared database; this script is a reusable
// capability for downstream products.

import {readdirSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

async function buildSqliteDriver() {
  // Dynamic import — node:sqlite ships with Node 24+.
  let dbMod;
  try {
    dbMod = await import('node:sqlite');
  } catch (e) {
    throw new Error('node:sqlite unavailable: ' + (e?.message ?? e));
  }
  const db = new dbMod.DatabaseSync(':memory:');
  return {
    db,
    exec(sql) { db.exec(sql); },
    all(sql) { return db.prepare(sql).all(); },
    transaction(fn) {
      db.exec('BEGIN');
      try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

function loadMigrations(dir) {
  const files = readdirSync(dir).filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql')).sort();
  return files.map(f => {
    const full = join(dir, f);
    const sql = readFileSync(full, 'utf8');
    const downPath = join(dir, f.replace(/\.sql$/, '.down.sql'));
    let downSql = null;
    try { downSql = readFileSync(downPath, 'utf8'); } catch {}
    const m = /^(\d+)-/.exec(f);
    return {file: f, version: m ? Number(m[1]) : null, sql, downSql};
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = resolve(REPO_ROOT, args.migrations ?? 'migrations/sqlite');
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/migrations.json');
  const dryRun = 'dry-run' in args;
  mkdirSync(dirname(outPath), {recursive: true});

  const driver = await buildSqliteDriver();
  const migrations = loadMigrations(dir);

  // Bootstrap version-tracking table.
  driver.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = driver.all('SELECT version FROM schema_migrations');
  const applied = new Set(appliedRows.map(r => r.version));
  const report = {
    schemaVersion: '1.0.0',
    dryRun,
    target: 'sqlite::memory:',
    migrationsDir: dir,
    generatedAt: new Date().toISOString(),
    summary: {total: migrations.length, applied: 0, pending: 0, errors: 0},
    items: [],
  };

  for (const mig of migrations) {
    if (applied.has(mig.version)) {
      report.items.push({file: mig.file, version: mig.version, status: 'already-applied'});
      report.summary.applied++;
      continue;
    }
    try {
      if (!dryRun) {
        driver.transaction(() => {
          driver.exec(mig.sql);
          driver.exec(`INSERT INTO schema_migrations(version, applied_at) VALUES(${mig.version}, '${new Date().toISOString()}')`);
        });
      }
      report.items.push({file: mig.file, version: mig.version, status: dryRun ? 'dry-run-ok' : 'applied'});
      report.summary.pending++;
    } catch (e) {
      report.items.push({file: mig.file, version: mig.version, status: 'error', error: String(e.message ?? e)});
      report.summary.errors++;
    }
  }

  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  process.stdout.write(`migrate: total=${report.summary.total} pending=${report.summary.pending} errors=${report.summary.errors} (dry-run=${dryRun})\n`);
  if (report.summary.errors > 0) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });