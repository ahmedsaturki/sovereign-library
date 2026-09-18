import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { runNpm } from './npm-cli.mjs';
import { spawnSync } from 'node:child_process';

const ROOT = resolve('.');
const OUT = resolve('.artifacts/reproducible-package');
const CANDIDATES = [
  { id: 'safe-path-resolver', packageDir: resolve('packages/safe-path-resolver') },
  { id: 'runtime-capability-inspector', packageDir: resolve('packages/runtime-capability-inspector') },
  { id: 'bounded-file-content-reader-safe-content-access', packageDir: resolve('packages/bounded-file-content-reader-safe-content-access') },
  { id: 'directory-walker-bounded-tree-traversal', packageDir: resolve('packages/directory-walker-bounded-tree-traversal') },
  { id: 'filesystem-metadata-stat-normalizer', packageDir: resolve('packages/filesystem-metadata-stat-normalizer') },
  { id: 'safe-file-quarantine-delete', packageDir: resolve('packages/safe-file-quarantine-delete') },
];

function fail(message) {
  throw new Error(`[repro-verify] ${message}`);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function packOnce(candidate, destination) {
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  const result = runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', destination], {
    cwd: candidate.packageDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(`${candidate.id} npm pack failed with ${result.status}: ${(result.stderr ?? '').trim()}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout ?? '');
  } catch (cause) {
    throw new Error(`[repro-verify] ${candidate.id} npm pack returned invalid JSON`, { cause });
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) fail(`${candidate.id} npm pack did not return exactly one result`);
  const meta = parsed[0];
  const tarball = resolve(destination, meta.filename);
  if (!existsSync(tarball)) fail(`${candidate.id} tarball missing: ${tarball}`);
  return {
    tarball,
    filename: meta.filename,
    integrity: meta.integrity ?? null,
    shasum: meta.shasum ?? null,
    files: (meta.files ?? []).map(({ path, size }) => ({ path, size })),
    bytes: readFileSync(tarball),
  };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

try {
  for (const candidate of CANDIDATES) {
    const firstDir = resolve(OUT, candidate.id, 'first');
    const secondDir = resolve(OUT, candidate.id, 'second');
    const firstStage = spawnSync(process.execPath, [resolve(ROOT, 'scripts/package-stage.mjs'), candidate.id], { stdio: 'inherit', shell: false });
    if (firstStage.status !== 0) fail(`${candidate.id} first staging failed with ${firstStage.status}`);
    const first = packOnce(candidate, firstDir);

    const secondStage = spawnSync(process.execPath, [resolve(ROOT, 'scripts/package-stage.mjs'), candidate.id], { stdio: 'inherit', shell: false });
    if (secondStage.status !== 0) fail(`${candidate.id} second staging failed with ${secondStage.status}`);
    const second = packOnce(candidate, secondDir);

    if (!first.bytes.equals(second.bytes)) {
      fail(`${candidate.id} tarball bytes are not reproducible: sha256 ${sha256(first.tarball)} != ${sha256(second.tarball)}`);
    }
    if (first.integrity !== second.integrity) fail(`${candidate.id} integrity changed between identical packs`);
    if (first.shasum !== second.shasum) fail(`${candidate.id} shasum changed between identical packs`);
    if (JSON.stringify(first.files) !== JSON.stringify(second.files)) fail(`${candidate.id} packaged file manifest changed between identical packs`);
    console.log(`[repro-verify] ${candidate.id}: byte-identical tarball, integrity, shasum, and file manifest`);
  }
  console.log('[repro-verify] ALL REPRODUCIBILITY CHECKS PASSED');
} finally {
  for (const candidate of CANDIDATES) {
    rmSync(resolve(candidate.packageDir, 'src'), { recursive: true, force: true });
    rmSync(resolve(candidate.packageDir, 'dist'), { recursive: true, force: true });
    rmSync(resolve(candidate.packageDir, 'LICENSE'), { force: true });
    rmSync(resolve(candidate.packageDir, 'NOTICE'), { force: true });
    rmSync(resolve(candidate.packageDir, 'node_modules'), { recursive: true, force: true });
  }
  rmSync(OUT, { recursive: true, force: true });
}
