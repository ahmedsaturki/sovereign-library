import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync, cpSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve('.');
const ALIAS = '#safe-path-resolver';
const RELATIVE_IMPORT = "import { resolveContained } from '../../safe-path-resolver-containment-boundary/src/index.js';";
const ALIAS_IMPORT = "import { resolveContained } from '#safe-path-resolver';";
const CANDIDATES = [
  {
    id: 'bounded-file-content-reader-safe-content-access',
    name: '@sovereign/bounded-file-content-reader-safe-content-access',
    description: 'Sovereign bounded-file-content-reader-safe-content-access Cube (standalone).',
    source: 'cubes/bounded-file-content-reader-safe-content-access/src/index.js',
    packageDir: 'packages/bounded-file-content-reader-safe-content-access',
    expected: ['FileContentReaderError', 'readFileContent', 'readFileStream', 'readFileChunks', 'defaultCapabilities', 'BOUNDED_FILE_CONTENT_READER_FORMAT'],
  },
  {
    id: 'directory-walker-bounded-tree-traversal',
    name: '@sovereign/directory-walker-bounded-tree-traversal',
    description: 'Sovereign directory-walker-bounded-tree-traversal Cube (standalone).',
    source: 'cubes/directory-walker-bounded-tree-traversal/src/index.js',
    packageDir: 'packages/directory-walker-bounded-tree-traversal',
    expected: ['DirectoryWalkerError', 'walk', 'defaultCapabilities'],
  },
  {
    id: 'filesystem-metadata-stat-normalizer',
    name: '@sovereign/filesystem-metadata-stat-normalizer',
    description: 'Sovereign filesystem-metadata-stat-normalizer Cube (standalone).',
    source: 'cubes/filesystem-metadata-stat-normalizer/src/index.js',
    packageDir: 'packages/filesystem-metadata-stat-normalizer',
    expected: ['MetadataNormalizerError', 'normalizeEntryMetadata', 'normalizeStat', 'serializeMetadata', 'parseMetadata', 'getDefaultCapabilities'],
  },
  {
    id: 'safe-file-quarantine-delete',
    name: '@sovereign/safe-file-quarantine-delete',
    description: 'Sovereign safe-file-quarantine-delete Cube (standalone).',
    source: 'cubes/safe-file-quarantine-delete/src/index.js',
    packageDir: 'packages/safe-file-quarantine-delete',
    expected: ['SafeFileQuarantineError', 'quarantineItem', 'restoreQuarantined', 'purgeQuarantined', 'defaultCapabilities', 'SAFE_FILE_QUARANTINE_FORMAT'],
  },
];

function fail(message) { throw new Error(`[safe-path-migration] ${message}`); }
function run(command, args, cwd = ROOT) {
  const r = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  if (r.error) throw r.error;
  if (r.status !== 0) fail(`${command} ${args.join(' ')} failed: ${`${r.stdout ?? ''}${r.stderr ?? ''}`.trim()}`);
  return r.stdout ?? '';
}
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function packageManifest(item) {
  return {
    name: item.name,
    version: '0.1.0',
    description: item.description,
    type: 'module',
    license: 'Apache-2.0',
    engines: { node: '>=24' },
    sideEffects: false,
    imports: { [ALIAS]: '@sovereign/safe-path-resolver' },
    dependencies: { '@sovereign/safe-path-resolver': '0.1.0' },
    exports: { '.': { types: './dist/index.d.ts', import: './src/index.js', default: './src/index.js' } },
    types: './dist/index.d.ts',
    files: ['src/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE', 'NOTICE', 'package.json'],
    repository: { type: 'git', url: 'git+https://github.com/ahmedsaturki/sovereign-library.git', directory: item.packageDir },
    homepage: 'https://github.com/ahmedsaturki/sovereign-library',
    bugs: { url: 'https://github.com/ahmedsaturki/sovereign-library/issues' },
  };
}

function patchRootPackage() {
  const path = resolve(ROOT, 'package.json');
  let text = readFileSync(path, 'utf8');
  if (!text.includes('"#safe-path-resolver"')) {
    text = text.replace('  "type": "module",\n', '  "type": "module",\n  "imports": {\n    "#safe-path-resolver": "./cubes/safe-path-resolver-containment-boundary/src/index.js"\n  },\n', 1);
  }
  writeFileSync(path, text, 'utf8');
}

function patchCandidates() {
  for (const item of CANDIDATES) {
    const sourcePath = resolve(ROOT, item.source);
    let text = readFileSync(sourcePath, 'utf8');
    if (!text.includes(RELATIVE_IMPORT) && !text.includes(ALIAS_IMPORT)) fail(`missing dependency import anchor: ${item.source}`);
    text = text.replace(RELATIVE_IMPORT, ALIAS_IMPORT);
    writeFileSync(sourcePath, text, 'utf8');
    const packageDir = resolve(ROOT, item.packageDir);
    mkdirSync(packageDir, { recursive: true });
    writeJson(resolve(packageDir, 'package.json'), packageManifest(item));
  }
}

function patchCatalog() {
  const path = resolve(ROOT, 'scripts/package-catalog.json');
  const catalog = JSON.parse(readFileSync(path, 'utf8'));
  for (const item of CANDIDATES) {
    catalog[item.id] = {
      name: item.name,
      version: '0.1.0',
      description: item.description,
      packageDir: item.packageDir,
      source: item.source,
      expected: item.expected,
      dependencies: { '@sovereign/safe-path-resolver': '0.1.0' },
      imports: { [ALIAS]: '@sovereign/safe-path-resolver' },
      status: 'TECHNICALLY_READY',
      reason: 'standalone-capable with explicit @sovereign/safe-path-resolver dependency boundary',
    };
  }
  writeJson(path, catalog);
}

function patchPackageStage() {
  const path = resolve(ROOT, 'scripts/package-stage.mjs');
  let text = readFileSync(path, 'utf8');
  if (!text.includes('function stageRuntimeDependencies')) {
    const anchor = 'function main() {\n';
    const inject = `function stageRuntimeDependencies(dependencies, catalog, packageDir) {\n  const nodeModules = resolve(packageDir, 'node_modules');\n  rmSync(nodeModules, { recursive: true, force: true });\n  for (const [dependencyName, dependencyVersion] of Object.entries(dependencies ?? {})) {\n    const depSpec = Object.values(catalog).find((candidate) => candidate.name === dependencyName && candidate.version === dependencyVersion);\n    if (!depSpec) fail(\\`runtime dependency not found in catalog: $\\{dependencyName}@$\\{dependencyVersion}\\`);\n    const depSource = resolve(depSpec.source);\n    if (!existsSync(depSource)) fail(\\`runtime dependency source is missing: $\\{depSource}\\`);\n    const parts = dependencyName.split('/');\n    const depRoot = parts[0].startsWith('@') ? resolve(nodeModules, parts[0], parts[1]) : resolve(nodeModules, dependencyName);\n    const depSrc = resolve(depRoot, 'src');\n    const depDist = resolve(depRoot, 'dist');\n    mkdirSync(depSrc, { recursive: true });\n    mkdirSync(depDist, { recursive: true });\n    const sourceRoot = dirname(depSource);\n    for (const entry of readdirSync(sourceRoot)) {\n      const full = resolve(sourceRoot, entry);\n      if (statSync(full).isDirectory()) cpSync(full, resolve(depSrc, entry), { recursive: true });\n      else if (entry.endsWith('.js') || entry.endsWith('.mjs') || entry.endsWith('.d.ts')) copyFileSync(full, resolve(depSrc, entry));\n    }\n    const stub = (depSpec.expected ?? []).map((name) => \\`export declare const $\\{name\\}: any;\\`).join('\\\\n') + '\\\\n';\n    writeFileSync(resolve(depDist, 'index.d.ts'), stub, 'utf8');\n    writeJson(resolve(depRoot, 'package.json'), { name: dependencyName, version: dependencyVersion, type: 'module', exports: { '.': { types: './dist/index.d.ts', import: './src/index.js', default: './src/index.js' } } });\n  }\n  return nodeModules;\n}\n\n`;
    if (!text.includes(anchor)) fail('package-stage main anchor missing');
    text = text.replace(anchor, inject + anchor, 1);
  }
  if (!text.includes('stageRuntimeDependencies(spec.dependencies, catalog, packageDir);')) {
    const anchor = '  const expected = new Set(spec.expected || []);\n';
    text = text.replace(anchor, anchor + '  stageRuntimeDependencies(spec.dependencies, catalog, packageDir);\n', 1);
  }
  if (!text.includes('rmSync(resolve(packageDir, \'node_modules\'), { recursive: true, force: true });')) {
    text = text.replace('try {\n  main();\n} finally {\n', 'try {\n  main();\n} finally {\n  try {\n    const candidate = process.argv[2];\n    if (candidate && existsSync(CATALOG_PATH)) {\n      const cleanupCatalog = JSON.parse(readFileSync(CATALOG_PATH, \'utf8\'));\n      const cleanupPackageDir = cleanupCatalog[candidate]?.packageDir;\n      if (cleanupPackageDir) rmSync(resolve(cleanupPackageDir, \'node_modules\'), { recursive: true, force: true });\n    }\n  } catch {}\n', 1);
  }
  text = text.replace('  rmSync(TOOLS_DIR, { recursive: true, force: true });\n}\n', '  rmSync(TOOLS_DIR, { recursive: true, force: true });\n}\n', 1);
  writeFileSync(path, text, 'utf8');
}

function patchTooling() {
  writeFileSync(resolve(ROOT, 'scripts/verify-package-tooling.mjs'), `import { existsSync, readFileSync, rmSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';\nimport { resolve, dirname, join } from 'node:path';\nimport { spawnSync } from 'node:child_process';\nimport { runNpm } from './npm-cli.mjs';\n\nconst ROOT = resolve('.');\nconst IDS = ['safe-path-resolver', 'runtime-capability-inspector', ...${JSON.stringify(CANDIDATES.map((x) => x.id))}];\nconst CATALOG = JSON.parse(readFileSync(resolve(ROOT, 'scripts/package-catalog.json'), 'utf8'));\nconst EXPECTED_FILES = new Set(['LICENSE', 'NOTICE', 'README.md', 'dist/index.d.ts', 'package.json', 'src/index.js']);\n\nfunction fail(message) { throw new Error(\`[package-verify] $\{message\}\`); }\nfunction runNode(args, cwd = ROOT) {\n  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });\n  if (r.error) throw r.error;\n  if (r.status !== 0) fail(\`node $\{args.join(' ')\} failed: $\{(r.stdout ?? '') + (r.stderr ?? '')\}\`);\n  return r.stdout ?? '';\n}\nfunction npm(args, cwd) {\n  const r = runNpm(args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });\n  if (r.status !== 0) fail(\`npm $\{args.join(' ')} failed: $\{r.stderr ?? ''\}\`);\n  return r.stdout ?? '';\n}\nfunction expectedSpec(id) { const spec = CATALOG[id]; if (!spec) fail(\`catalog entry missing: $\{id\}\`); return spec; }\n\nfunction runtimeProbe(id, spec, packageDir) {\n  const consumer = resolve(ROOT, '.artifacts/package-verify-consumer', id);\n  rmSync(consumer, { recursive: true, force: true });\n  const scopeRoot = resolve(consumer, 'node_modules/@sovereign');\n  const candidateRoot = resolve(scopeRoot, id);\n  mkdirSync(scopeRoot, { recursive: true });\n  cpSync(resolve(packageDir, 'src'), resolve(candidateRoot, 'src'), { recursive: true });\n  cpSync(resolve(packageDir, 'dist'), resolve(candidateRoot, 'dist'), { recursive: true });\n  for (const file of ['README.md', 'LICENSE', 'NOTICE', 'package.json']) { const source = resolve(packageDir, file); if (existsSync(source)) cpSync(source, resolve(candidateRoot, file)); }\n  const dependencies = spec.dependencies ?? {};\n  for (const dependencyName of Object.keys(dependencies)) {\n    const dep = CATALOG[dependencyName === '@sovereign/safe-path-resolver' ? 'safe-path-resolver' : ''];\n    if (!dep) fail(\`dependency catalog entry missing: $\{dependencyName\}\`);\n    const depRoot = resolve(consumer, 'node_modules/@sovereign/safe-path-resolver');\n    mkdirSync(depRoot, { recursive: true });\n    cpSync(resolve(ROOT, dirname(dep.source)), resolve(depRoot, 'src'), { recursive: true });\n    writeFileSync(resolve(depRoot, 'package.json'), JSON.stringify({ name: dependencyName, version: dependencies[dependencyName], type: 'module', exports: { '.': './src/index.js' } }, null, 2) + '\\n');\n  }\n  const expected = JSON.stringify(spec.expected ?? []);\n  runNode(['--input-type=module', '-e', \\`const m=await import('' + ${JSON.stringify(spec.name)} + ''); const e=${expected}; for (const k of e) if (!(k in m)) throw new Error('missing export '+k);\\`], consumer);\n  rmSync(consumer, { recursive: true, force: true });\n}\n\nrmSync(resolve(ROOT, '.artifacts/package-verify-consumer'), { recursive: true, force: true });\nfor (const id of IDS) {\n  const spec = expectedSpec(id);\n  const packageDir = resolve(ROOT, spec.packageDir);\n  const packageJsonPath = resolve(packageDir, 'package.json');\n  if (!existsSync(packageJsonPath)) fail(\`$\{id} package.json missing\`);\n  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));\n  if (pkg.private === true || pkg.license !== 'Apache-2.0' || pkg.type !== 'module' || pkg.engines?.node !== '>=24' || pkg.sideEffects !== false) fail(\`$\{id} core manifest contract failed\`);\n  if (JSON.stringify(pkg.dependencies ?? {}) !== JSON.stringify(spec.dependencies ?? {})) fail(\`$\{id} dependency declaration mismatch\`);\n  if (JSON.stringify(pkg.imports ?? {}) !== JSON.stringify(spec.imports ?? {})) fail(\`$\{id} imports mapping mismatch\`);\n  if (pkg.devDependencies || pkg.peerDependencies || pkg.optionalDependencies || pkg.scripts) fail(\`$\{id} has forbidden dependency/script declarations\`);\n  if (JSON.stringify(Object.keys(pkg.exports ?? {})) !== '["."]') fail(\`$\{id} export map mismatch\`);\n  const rootExport = pkg.exports['.'];\n  if (rootExport?.types !== './dist/index.d.ts' || rootExport?.import !== './src/index.js' || rootExport?.default !== './src/index.js') fail(\`$\{id} root export contract failed\`);\n  const packDir = resolve(ROOT, '.artifacts/package-verify', id);\n  rmSync(packDir, { recursive: true, force: true });\n  mkdirSync(packDir, { recursive: true });\n  try {\n    runNode([resolve(ROOT, 'scripts/package-stage.mjs'), id]);\n    const packed = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', packDir], packageDir));\n    if (!Array.isArray(packed) || packed.length !== 1) fail(\`$\{id} npm pack result invalid\`);\n    const files = new Set((packed[0].files ?? []).map((f) => String(f.path).replaceAll('\\\\', '/')));\n    for (const file of EXPECTED_FILES) if (!files.has(file)) fail(\`$\{id} tarball missing $\{file}\`);\n    for (const file of files) if (!EXPECTED_FILES.has(file)) fail(\`$\{id} tarball contains undeclared file $\{file}\`);\n    runtimeProbe(id, spec, packageDir);\n    console.log(\`[package-verify] $\{id}: manifest, dependency boundary, declaration, pack, and isolated runtime import passed\`);\n  } finally {\n    rmSync(packDir, { recursive: true, force: true });\n    rmSync(resolve(packageDir, 'src'), { recursive: true, force: true });\n    rmSync(resolve(packageDir, 'dist'), { recursive: true, force: true });\n    rmSync(resolve(packageDir, 'node_modules'), { recursive: true, force: true });\n    rmSync(resolve(packageDir, 'LICENSE'), { force: true });\n    rmSync(resolve(packageDir, 'NOTICE'), { force: true });\n  }\n}\nconsole.log('[package-verify] SAFE-PATH BOUNDARY QUALIFICATION WAVE PASSED');\n`, 'utf8');
}

function patchRepro() {
  const path = resolve(ROOT, 'scripts/verify-reproducible-package.mjs');
  let text = readFileSync(path, 'utf8');
  const ids = `const CANDIDATE_IDS = ${JSON.stringify(['safe-path-resolver', 'runtime-capability-inspector', ...CANDIDATES.map((x) => x.id)], null, 2)};`;
  text = text.replace(/const CANDIDATES = \[[\s\S]*?\];\n\nfunction fail/, ids + '\nconst CATALOG = JSON.parse(readFileSync(resolve(ROOT, \'scripts/package-catalog.json\'), \'utf8\'));\n\nfunction fail', 1);
  text = text.replace(/for \(const candidate of CANDIDATES\) \{/, 'for (const id of CANDIDATE_IDS) {\n    const candidate = { id, packageDir: resolve(CATALOG[id].packageDir) };', 1);
  text = text.replace(/candidate\.id/g, 'candidate.id');
  text = text.replace(/for \(const candidate of CANDIDATES\) \{\n    rmSync\(resolve\(candidate\.packageDir, 'src'\)[\s\S]*?\n  \}/, 'for (const id of CANDIDATE_IDS) {\n    const packageDir = resolve(CATALOG[id].packageDir);\n    rmSync(resolve(packageDir, \'src\'), { recursive: true, force: true });\n    rmSync(resolve(packageDir, \'dist\'), { recursive: true, force: true });\n    rmSync(resolve(packageDir, \'node_modules\'), { recursive: true, force: true });\n    rmSync(resolve(packageDir, \'LICENSE\'), { force: true });\n    rmSync(resolve(packageDir, \'NOTICE\'), { force: true });\n  }', 1);
  writeFileSync(path, text, 'utf8');
}

function patchSecurity() {
  const path = resolve(ROOT, 'scripts/verify-security-boundaries.mjs');
  let text = readFileSync(path, 'utf8');
  const marker = "const catalog = JSON.parse(readFileSync(resolve(ROOT, 'scripts/package-catalog.json'), 'utf8'));";
  if (!text.includes(marker)) {
    text = text.replace("for (const packageName of ['safe-path-resolver', 'runtime-capability-inspector']) {", marker + "\nfor (const [packageName, spec] of Object.entries(catalog)) {");
    const oldBodyStart = "  const packageJsonPath = resolve(ROOT, 'packages', packageName, 'package.json');";
    text = text.replace(oldBodyStart, "  const packageJsonPath = resolve(ROOT, spec.packageDir, 'package.json');");
    const oldDepBlock = "  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {\n    if (pkg[field] && Object.keys(pkg[field]).length > 0) {\n      violations.push({ file: relative(ROOT, packageJsonPath), line: 1, rule: 'package-dependency-free', message: `${field} must be absent for a dependency-free public cube`, source: JSON.stringify(pkg[field]) });\n    }\n  }";
    if (text.includes(oldDepBlock)) {
      text = text.replace(oldDepBlock, "  const expectedDeps = spec.dependencies ?? {};\n  const actualDeps = pkg.dependencies ?? {};\n  if (JSON.stringify(actualDeps) !== JSON.stringify(expectedDeps)) violations.push({ file: relative(ROOT, packageJsonPath), line: 1, rule: 'package-dependency-boundary', message: 'dependency declaration does not match catalog', source: JSON.stringify(actualDeps) });\n  for (const field of ['devDependencies', 'peerDependencies', 'optionalDependencies']) {\n    if (pkg[field] && Object.keys(pkg[field]).length > 0) violations.push({ file: relative(ROOT, packageJsonPath), line: 1, rule: 'package-extra-dependencies', message: `${field} must be absent`, source: JSON.stringify(pkg[field]) });\n  }");
    }
  }
  writeFileSync(path, text, 'utf8');
}

function patchMatrixAndControl() {
  const matrixPath = resolve(ROOT, 'docs/release/PACKAGE_QUALIFICATION_MATRIX-V0.1.md');
  let matrix = readFileSync(matrixPath, 'utf8');
  matrix = matrix.replace('# Package Qualification Matrix (v15)', '# Package Qualification Matrix (v16)');
  matrix = matrix.replace('| TECHNICALLY_READY | 73 |', '| TECHNICALLY_READY | 77 |');
  matrix = matrix.replace('| CONDITIONAL | 4 |', '| CONDITIONAL | 0 |');
  for (const item of CANDIDATES) {
    const row = new RegExp(`^\\| ${item.id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')} \\| CONDITIONAL \\| — \\|.*$`, 'm');
    matrix = matrix.replace(row, `| ${item.id} | TECHNICALLY_READY | ${item.name} | explicit @sovereign/safe-path-resolver dependency boundary; standalone package staged and qualified |`);
  }
  writeFileSync(matrixPath, matrix, 'utf8');

  const controlPath = resolve(ROOT, 'PROJECT_CONTROL.md');
  let control = readFileSync(controlPath, 'utf8');
  control = control.replace('74 package entries representing 73 unique Cube sources', '78 package entries representing 77 unique Cube sources');
  control = control.replace('- Cubes with unresolved runtime coupling kept CONDITIONAL until the dependency boundary can be made real without breaking monorepo behavior;\n', '- The previously Conditional safe-path-resolver consumers now use an explicit package dependency boundary; no current safe-path-resolver consumer remains in CONDITIONAL status.\n');
  writeFileSync(controlPath, control, 'utf8');
}

function main() {
  patchRootPackage();
  patchCandidates();
  patchCatalog();
  patchPackageStage();
  patchTooling();
  patchRepro();
  patchSecurity();

  const targeted = CANDIDATES.map((x) => `${x.packageDir.split('/').join('/')}/test/index.test.js`);
  run(process.execPath, ['--check', ...CANDIDATES.map((x) => x.source)]);
  run(process.execPath, ['--test', '--test-timeout=10000', ...targeted]);
  run(process.execPath, ['scripts/verify-package-tooling.mjs']);
  run(process.execPath, ['scripts/verify-reproducible-package.mjs']);
  run(process.execPath, ['scripts/verify-security-boundaries.mjs']);

  patchMatrixAndControl();
  rmSync(resolve(ROOT, '.automation/safe-path-boundary-qualification'), { force: true });
  rmSync(resolve(ROOT, 'scripts/migrate-safe-path-boundaries.mjs'), { force: true });
  run('git', ['diff', '--check']);
  console.log('[safe-path-migration] QUALIFICATION MIGRATION VERIFIED');
}

main();
