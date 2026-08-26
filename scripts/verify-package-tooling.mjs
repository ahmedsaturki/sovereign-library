import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve('.');
const CANDIDATES = [
  {
    id: 'safe-path-resolver',
    packageDir: resolve('packages/safe-path-resolver'),
    script: resolve('scripts/package-stage.mjs'),
  },
  {
    id: 'runtime-capability-inspector',
    packageDir: resolve('packages/runtime-capability-inspector'),
    script: resolve('scripts/package-stage.mjs'),
  },
];

const expectedFiles = new Set([
  'LICENSE',
  'NOTICE',
  'README.md',
  'dist/index.d.ts',
  'package.json',
  'src/index.js',
]);

function fail(message) {
  throw new Error(`[package-verify] ${message}`);
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    fail(`${command} ${args.join(' ')} failed with ${result.status}: ${output}`);
  }
  return result.stdout ?? '';
}

for (const candidate of CANDIDATES) {
  const packageJsonPath = resolve(candidate.packageDir, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (pkg.private === true) fail(`${candidate.id} must not be private`);
  if (pkg.license !== 'Apache-2.0') fail(`${candidate.id} has incorrect license`);
  if (pkg.type !== 'module') fail(`${candidate.id} must be ESM`);
  if (pkg.engines?.node !== '>=24') fail(`${candidate.id} must require Node >=24`);
  if (pkg.sideEffects !== false) fail(`${candidate.id} must set sideEffects=false`);
  if (pkg.dependencies || pkg.peerDependencies || pkg.optionalDependencies) fail(`${candidate.id} must have no runtime dependency declarations`);
  if (pkg.scripts) fail(`${candidate.id} must not ship development scripts`);
  if (JSON.stringify(Object.keys(pkg.exports ?? {})) !== '["."]') fail(`${candidate.id} must expose only the root export`);
  const rootExport = pkg.exports['.'];
  if (rootExport?.types !== './dist/index.d.ts' || rootExport?.import !== './src/index.js' || rootExport?.default !== './src/index.js') {
    fail(`${candidate.id} has an invalid root export map`);
  }
  if (!Array.isArray(pkg.files) || new Set(pkg.files).size !== pkg.files.length || !pkg.files.every((file) => expectedFiles.has(file))) {
    fail(`${candidate.id} has an invalid files allowlist`);
  }

  run(process.execPath, [candidate.script, candidate.id]);
  const packDir = resolve('.artifacts/package-verify', candidate.id);
  rmSync(packDir, { recursive: true, force: true });
  const packJsonText = run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', packDir], candidate.packageDir);
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
  const tarball = resolve(packDir, packResult[0].filename);
  if (!existsSync(tarball)) fail(`${candidate.id} tarball was not created`);
  console.log(`[package-verify] ${candidate.id}: manifest, export map, staging, and npm pack contents passed`);
  rmSync(packDir, { recursive: true, force: true });
  rmSync(resolve(candidate.packageDir, 'src'), { recursive: true, force: true });
  rmSync(resolve(candidate.packageDir, 'dist'), { recursive: true, force: true });
  rmSync(resolve(candidate.packageDir, 'LICENSE'), { force: true });
  rmSync(resolve(candidate.packageDir, 'NOTICE'), { force: true });
}

console.log('[package-verify] ALL PACKAGE TOOLING CHECKS PASSED');
