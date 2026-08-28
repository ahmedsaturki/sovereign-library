import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve('.');
const CATALOG = JSON.parse(readFileSync(resolve(ROOT, 'scripts/package-catalog.json'), 'utf8'));
const CANDIDATE_IDS = ['safe-path-resolver', 'runtime-capability-inspector', 'bounded-file-content-reader-safe-content-access', 'directory-walker-bounded-tree-traversal', 'filesystem-metadata-stat-normalizer', 'safe-file-quarantine-delete'];
const CANDIDATES = CANDIDATE_IDS.map((id) => ({ id, packageDir: resolve(CATALOG[id].packageDir), script: resolve('scripts/package-stage.mjs'), dependencies: CATALOG[id].dependencies ?? {}, imports: CATALOG[id].imports ?? {} }));

const expectedFiles = new Set([
  'LICENSE',
  'NOTICE',
  'README.md',
  'dist/index.d.ts',
  'package.json',
  'src/index.js',
]);

const bundledNpmCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');

function fail(message) {
  throw new Error(`[package-verify] ${message}`);
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    fail(`${command} ${args.join(' ')} failed with ${result.status}: ${output}`);
  }
  return result.stdout ?? '';
}

function runNpm(args, cwd) {
  if (existsSync(bundledNpmCli)) return run(process.execPath, [bundledNpmCli, ...args], cwd);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return run(npm, args, cwd);
}

for (const candidate of CANDIDATES) {
  const packageJsonPath = resolve(candidate.packageDir, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (pkg.private === true) fail(`${candidate.id} must not be private`);
  if (pkg.license !== 'Apache-2.0') fail(`${candidate.id} has incorrect license`);
  if (pkg.type !== 'module') fail(`${candidate.id} must be ESM`);
  if (pkg.engines?.node !== '>=24') fail(`${candidate.id} must require Node >=24`);
  if (pkg.sideEffects !== false) fail(`${candidate.id} must set sideEffects=false`);
  if (JSON.stringify(pkg.dependencies ?? {}) !== JSON.stringify(candidate.dependencies)) fail(`${candidate.id} runtime dependency boundary mismatch`);
  if (JSON.stringify(pkg.imports ?? {}) !== JSON.stringify(candidate.imports)) fail(`${candidate.id} imports boundary mismatch`);
  if (pkg.devDependencies || pkg.peerDependencies || pkg.optionalDependencies) fail(`${candidate.id} must not declare dev/peer/optional dependencies`);
  if (pkg.scripts) fail(`${candidate.id} must not ship development scripts`);
  if (JSON.stringify(Object.keys(pkg.exports ?? {})) !== '["."]') fail(`${candidate.id} must expose only the root export`);
  const rootExport = pkg.exports['.'];
  if (rootExport?.types !== './dist/index.d.ts' || rootExport?.import !== './src/index.js' || rootExport?.default !== './src/index.js') {
    fail(`${candidate.id} has an invalid root export map`);
  }
  if (!Array.isArray(pkg.files) || new Set(pkg.files).size !== pkg.files.length || !pkg.files.every((file) => expectedFiles.has(file))) {
    fail(`${candidate.id} has an invalid files allowlist`);
  }

  const packDir = resolve('.artifacts/package-verify', candidate.id);
  try {
    run(process.execPath, [candidate.script, candidate.id]);
    rmSync(packDir, { recursive: true, force: true });
    mkdirSync(packDir, { recursive: true });

    const packJsonText = runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', packDir], candidate.packageDir);
    const packResult = JSON.parse(packJsonText);
    if (!Array.isArray(packResult) || packResult.length !== 1) fail(`${candidate.id} npm pack did not return exactly one package result`);
    const files = new Set((packResult[0].files ?? []).map((entry) => String(entry.path).replaceAll('\\', '/')));
    for (const file of expectedFiles) if (!files.has(file)) fail(`${candidate.id} tarball is missing ${file}`);
    for (const file of files) {
      if (!expectedFiles.has(file)) fail(`${candidate.id} tarball contains undeclared file ${file}`);
      if (file.startsWith('.github/') || file.startsWith('.git/') || file.startsWith('.artifacts/') || file.includes('test')) {
        fail(`${candidate.id} tarball crossed a prohibited boundary: ${file}`);
      }
    }
    run(process.execPath, ['--input-type=module', '-e', "await import('./src/index.js')"], candidate.packageDir);
    const tarball = resolve(packDir, packResult[0].filename);
    if (!existsSync(tarball)) fail(`${candidate.id} tarball was not created`);
    console.log(`[package-verify] ${candidate.id}: manifest, export map, staging, and npm pack contents passed`);
  } finally {
    rmSync(packDir, { recursive: true, force: true });
    rmSync(resolve(candidate.packageDir, 'src'), { recursive: true, force: true });
    rmSync(resolve(candidate.packageDir, 'dist'), { recursive: true, force: true });
    rmSync(resolve(candidate.packageDir, 'LICENSE'), { force: true });
    rmSync(resolve(candidate.packageDir, 'NOTICE'), { force: true });
    rmSync(resolve(candidate.packageDir, 'node_modules'), { recursive: true, force: true });
  }
}

console.log('[package-verify] ALL PACKAGE TOOLING CHECKS PASSED');
