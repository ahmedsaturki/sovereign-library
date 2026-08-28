import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve('.');
const RESOLVER = '@sovereign/safe-path-resolver';
const VERSION = '0.1.0';
const CANDIDATES = [
  ['bounded-file-content-reader-safe-content-access', 'cubes/bounded-file-content-reader-safe-content-access/src/index.js'],
  ['directory-walker-bounded-tree-traversal', 'cubes/directory-walker-bounded-tree-traversal/src/index.js'],
  ['filesystem-metadata-stat-normalizer', 'cubes/filesystem-metadata-stat-normalizer/src/index.js'],
  ['safe-file-quarantine-delete', 'cubes/safe-file-quarantine-delete/src/index.js'],
];

function fail(message) {
  throw new Error(`[safe-path-migration] ${message}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function findSpec(catalog, source) {
  const found = Object.entries(catalog).find(([, spec]) => spec?.source === source);
  if (!found) fail(`catalog entry not found for source ${source}`);
  return found;
}

function packageManifest(slug) {
  return {
    name: `@sovereign/${slug}`,
    version: VERSION,
    description: `Sovereign ${slug} Cube (standalone).`,
    type: 'module',
    license: 'Apache-2.0',
    engines: { node: '>=24' },
    sideEffects: false,
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './src/index.js',
        default: './src/index.js',
      },
    },
    types: './dist/index.d.ts',
    dependencies: { [RESOLVER]: VERSION },
    files: ['src/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE', 'NOTICE', 'package.json'],
    repository: {
      type: 'git',
      url: 'git+https://github.com/ahmedsaturki/sovereign-library.git',
      directory: `packages/${slug}`,
    },
    homepage: 'https://github.com/ahmedsaturki/sovereign-library',
    bugs: { url: 'https://github.com/ahmedsaturki/sovereign-library/issues' },
  };
}

function createPrepScript() {
  const path = resolve(ROOT, 'scripts/prepare-local-package-dependencies.mjs');
  if (existsSync(path)) return;
  writeFileSync(path, `import { lstat, mkdir, realpath, rm, symlink } from 'node:fs/promises';\nimport { dirname, resolve } from 'node:path';\nimport process from 'node:process';\n\nconst target = resolve('packages/safe-path-resolver');\nconst link = resolve('node_modules/@sovereign/safe-path-resolver');\n\nasync function main() {\n  await mkdir(dirname(link), { recursive: true });\n  let valid = false;\n  try {\n    valid = (await realpath(link)) === (await realpath(target));\n  } catch {\n    valid = false;\n  }\n  if (valid) return;\n  try {\n    const current = await lstat(link);\n    if (current.isSymbolicLink() || current.isDirectory() || current.isFile()) await rm(link, { recursive: true, force: true });\n  } catch {\n    // The link may not exist yet.\n  }\n  const type = process.platform === 'win32' ? 'junction' : 'dir';\n  await symlink(target, link, type);\n}\n\nawait main();\n`, 'utf8');
}

function prependScript(command) {
  const prefix = 'node scripts/prepare-local-package-dependencies.mjs && ';
  return command.startsWith(prefix) ? command : `${prefix}${command}`;
}

function updateRootPackage() {
  const path = resolve(ROOT, 'package.json');
  const data = readJson(path);
  data.scripts ??= {};
  data.scripts.test = prependScript(data.scripts.test);
  for (const key of [
    'test:bounded-file-content-reader-safe-content-access',
    'test:directory-walker-bounded-tree-traversal',
    'test:filesystem-metadata-stat-normalizer',
    'test:safe-file-quarantine-delete',
  ]) {
    if (data.scripts[key]) data.scripts[key] = prependScript(data.scripts[key]);
  }
  writeJson(path, data);
}

function updatePackageTooling() {
  const path = resolve(ROOT, 'scripts/verify-package-tooling.mjs');
  writeFileSync(path, `import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';\nimport { dirname, resolve } from 'node:path';\nimport { spawnSync } from 'node:child_process';\n\nconst ROOT = resolve('.');\nconst CATALOG_PATH = resolve('scripts/package-catalog.json');\nconst SOURCES = [\n  'cubes/safe-path-resolver-containment-boundary/src/index.js',\n  'cubes/runtime-capability-inspector/src/index.js',\n  'cubes/bounded-file-content-reader-safe-content-access/src/index.js',\n  'cubes/directory-walker-bounded-tree-traversal/src/index.js',\n  'cubes/filesystem-metadata-stat-normalizer/src/index.js',\n  'cubes/safe-file-quarantine-delete/src/index.js',\n];\nconst EXPECTED_FILES = new Set(['LICENSE', 'NOTICE', 'README.md', 'dist/index.d.ts', 'package.json', 'src/index.js']);\nconst EXPECTED_DEPENDENCIES = new Set([\n  'cubes/safe-path-resolver-containment-boundary/src/index.js|{}',\n  'cubes/runtime-capability-inspector/src/index.js|{}',\n  'cubes/bounded-file-content-reader-safe-content-access/src/index.js|{"@sovereign/safe-path-resolver":"0.1.0"}',\n  'cubes/directory-walker-bounded-tree-traversal/src/index.js|{"@sovereign/safe-path-resolver":"0.1.0"}',\n  'cubes/filesystem-metadata-stat-normalizer/src/index.js|{"@sovereign/safe-path-resolver":"0.1.0"}',\n  'cubes/safe-file-quarantine-delete/src/index.js|{"@sovereign/safe-path-resolver":"0.1.0"}',\n]);\nconst bundledNpmCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');\n\nfunction fail(message) { throw new Error(\`[package-verify] \${message}\`); }\nfunction run(command, args, cwd = ROOT) {\n  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });\n  if (result.error) throw result.error;\n  if (result.status !== 0) fail(\`\${command} \${args.join(' ')} failed with \${result.status}: \${(result.stdout ?? '') + (result.stderr ?? '')}\`);\n  return result.stdout ?? '';\n}\nfunction runNpm(args, cwd) {\n  if (existsSync(bundledNpmCli)) return run(process.execPath, [bundledNpmCli, ...args], cwd);\n  return run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, cwd);\n}\nfunction loadCandidates() {\n  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));\n  return SOURCES.map((source) => {\n    const entry = Object.entries(catalog).find(([, spec]) => spec?.source === source);\n    if (!entry) fail(\`catalog entry missing for \${source}\`);\n    const [id, spec] = entry;\n    return { id, source, packageDir: resolve(spec.packageDir), script: resolve('scripts/package-stage.mjs'), dependencies: spec.dependencies ?? (source.includes('safe-path-resolver-containment-boundary') || source.includes('runtime-capability-inspector') ? {} : { '@sovereign/safe-path-resolver': '0.1.0' }) };\n  });\n}\n\nfor (const candidate of loadCandidates()) {\n  const packageJsonPath = resolve(candidate.packageDir, 'package.json');\n  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));\n  if (pkg.private === true) fail(\`\${candidate.id} must not be private\`);\n  if (pkg.license !== 'Apache-2.0') fail(\`\${candidate.id} has incorrect license\`);\n  if (pkg.type !== 'module') fail(\`\${candidate.id} must be ESM\`);\n  if (pkg.engines?.node !== '>=24') fail(\`\${candidate.id} must require Node >=24\`);\n  if (pkg.sideEffects !== false) fail(\`\${candidate.id} must set sideEffects=false\`);\n  if (pkg.scripts) fail(\`\${candidate.id} must not ship development scripts\`);\n  const actualDeps = pkg.dependencies ?? {};\n  const expectedDeps = candidate.dependencies ?? {};\n  if (JSON.stringify(actualDeps) !== JSON.stringify(expectedDeps)) fail(\`\${candidate.id} has incorrect runtime dependencies\`);\n  if (pkg.peerDependencies || pkg.optionalDependencies) fail(\`\${candidate.id} must not declare peer/optional dependencies\`);\n  if (!EXPECTED_DEPENDENCIES.has(\`\${candidate.source}|\${JSON.stringify(expectedDeps)}\`)) fail(\`\${candidate.id} has an unexpected dependency contract\`);\n  if (JSON.stringify(Object.keys(pkg.exports ?? {})) !== '["."]') fail(\`\${candidate.id} must expose only the root export\`);\n  const rootExport = pkg.exports['.'];\n  if (rootExport?.types !== './dist/index.d.ts' || rootExport?.import !== './src/index.js' || rootExport?.default !== './src/index.js') fail(\`\${candidate.id} has an invalid root export map\`);\n  if (!Array.isArray(pkg.files) || new Set(pkg.files).size !== pkg.files.length || !pkg.files.every((file) => EXPECTED_FILES.has(file))) fail(\`\${candidate.id} has an invalid files allowlist\`);\n\n  const packDir = resolve('.artifacts/package-verify', candidate.id);\n  try {\n    run(process.execPath, [candidate.script, candidate.id]);\n    rmSync(packDir, { recursive: true, force: true });\n    mkdirSync(packDir, { recursive: true });\n    const packJsonText = runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', packDir], candidate.packageDir);\n    const packResult = JSON.parse(packJsonText);\n    if (!Array.isArray(packResult) || packResult.length !== 1) fail(\`\${candidate.id} npm pack did not return exactly one package result\`);\n    const files = new Set((packResult[0].files ?? []).map((entry) => String(entry.path).replaceAll('\\\\', '/')));\n    for (const file of EXPECTED_FILES) if (!files.has(file)) fail(\`\${candidate.id} tarball is missing \${file}\`);\n    for (const file of files) {\n      if (!EXPECTED_FILES.has(file)) fail(\`\${candidate.id} tarball contains undeclared file \${file}\`);\n      if (file.startsWith('.github/') || file.startsWith('.git/') || file.startsWith('.artifacts/') || file.includes('test')) fail(\`\${candidate.id} tarball crossed a prohibited boundary: \${file}\`);\n    }\n    const tarball = resolve(packDir, packResult[0].filename);\n    if (!existsSync(tarball)) fail(\`\${candidate.id} tarball was not created\`);\n    console.log(\`[package-verify] \${candidate.id}: manifest, dependency boundary, export map, staging, and npm pack contents passed\`);\n  } finally {\n    rmSync(packDir, { recursive: true, force: true });\n    rmSync(resolve(candidate.packageDir, 'src'), { recursive: true, force: true });\n    rmSync(resolve(candidate.packageDir, 'dist'), { recursive: true, force: true });\n    rmSync(resolve(candidate.packageDir, 'LICENSE'), { force: true });\n    rmSync(resolve(candidate.packageDir, 'NOTICE'), { force: true });\n  }\n}\n\nconsole.log('[package-verify] ALL PACKAGE TOOLING CHECKS PASSED');\n`, 'utf8');
}

function updateReproducibilityVerifier() {
  const path = resolve(ROOT, 'scripts/verify-reproducible-package.mjs');
  writeFileSync(path, `import { createHash } from 'node:crypto';\nimport { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';\nimport { resolve } from 'node:path';\nimport { runNpm } from './npm-cli.mjs';\nimport { spawnSync } from 'node:child_process';\n\nconst ROOT = resolve('.');\nconst OUT = resolve('.artifacts/reproducible-package');\nconst SOURCES = [\n  'cubes/safe-path-resolver-containment-boundary/src/index.js',\n  'cubes/runtime-capability-inspector/src/index.js',\n  'cubes/bounded-file-content-reader-safe-content-access/src/index.js',\n  'cubes/directory-walker-bounded-tree-traversal/src/index.js',\n  'cubes/filesystem-metadata-stat-normalizer/src/index.js',\n  'cubes/safe-file-quarantine-delete/src/index.js',\n];\n\nfunction fail(message) { throw new Error(\`[repro-verify] \${message}\`); }\nfunction sha256(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }\nfunction loadCandidates() {\n  const catalog = JSON.parse(readFileSync(resolve(ROOT, 'scripts/package-catalog.json'), 'utf8'));\n  return SOURCES.map((source) => {\n    const entry = Object.entries(catalog).find(([, spec]) => spec?.source === source);\n    if (!entry) fail(\`catalog entry missing for \${source}\`);\n    return { id: entry[0], packageDir: resolve(entry[1].packageDir) };\n  });\n}\nfunction packOnce(candidate, destination) {\n  rmSync(destination, { recursive: true, force: true });\n  mkdirSync(destination, { recursive: true });\n  const result = runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', destination], { cwd: candidate.packageDir, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });\n  if (result.status !== 0) fail(\`\${candidate.id} npm pack failed with \${result.status}: \${(result.stderr ?? '').trim()}\`);\n  let parsed;\n  try { parsed = JSON.parse(result.stdout ?? ''); } catch (cause) { throw new Error(\`[repro-verify] \${candidate.id} npm pack returned invalid JSON\`, { cause }); }\n  if (!Array.isArray(parsed) || parsed.length !== 1) fail(\`\${candidate.id} npm pack did not return exactly one result\`);\n  const meta = parsed[0];\n  const tarball = resolve(destination, meta.filename);\n  if (!existsSync(tarball)) fail(\`\${candidate.id} tarball missing: \${tarball}\`);\n  return { tarball, integrity: meta.integrity ?? null, shasum: meta.shasum ?? null, files: (meta.files ?? []).map(({ path, size }) => ({ path, size })), bytes: readFileSync(tarball) };\n}\n\nrmSync(OUT, { recursive: true, force: true });\nmkdirSync(OUT, { recursive: true });\ntry {\n  for (const candidate of loadCandidates()) {\n    const firstStage = spawnSync(process.execPath, [resolve(ROOT, 'scripts/package-stage.mjs'), candidate.id], { stdio: 'inherit', shell: false });\n    if (firstStage.status !== 0) fail(\`\${candidate.id} first staging failed with \${firstStage.status}\`);\n    const first = packOnce(candidate, resolve(OUT, candidate.id, 'first'));\n    const secondStage = spawnSync(process.execPath, [resolve(ROOT, 'scripts/package-stage.mjs'), candidate.id], { stdio: 'inherit', shell: false });\n    if (secondStage.status !== 0) fail(\`\${candidate.id} second staging failed with \${secondStage.status}\`);\n    const second = packOnce(candidate, resolve(OUT, candidate.id, 'second'));\n    if (!first.bytes.equals(second.bytes)) fail(\`\${candidate.id} tarball bytes are not reproducible: sha256 \${sha256(first.tarball)} != \${sha256(second.tarball)}\`);\n    if (first.integrity !== second.integrity) fail(\`\${candidate.id} integrity changed between identical packs\`);\n    if (first.shasum !== second.shasum) fail(\`\${candidate.id} shasum changed between identical packs\`);\n    if (JSON.stringify(first.files) !== JSON.stringify(second.files)) fail(\`\${candidate.id} packaged file manifest changed between identical packs\`);\n    console.log(\`[repro-verify] \${candidate.id}: byte-identical tarball, integrity, shasum, and file manifest\`);\n  }\n  console.log('[repro-verify] ALL REPRODUCIBILITY CHECKS PASSED');\n} finally {\n  for (const candidate of loadCandidates()) {\n    rmSync(resolve(candidate.packageDir, 'src'), { recursive: true, force: true });\n    rmSync(resolve(candidate.packageDir, 'dist'), { recursive: true, force: true });\n    rmSync(resolve(candidate.packageDir, 'LICENSE'), { force: true });\n    rmSync(resolve(candidate.packageDir, 'NOTICE'), { force: true });\n  }\n  rmSync(OUT, { recursive: true, force: true });\n}\n`, 'utf8');
}

function updateSecurityVerifier() {
  const path = resolve(ROOT, 'scripts/verify-security-boundaries.mjs');
  writeFileSync(path, `import { existsSync, readdirSync, readFileSync } from 'node:fs';\nimport { resolve, join, relative } from 'node:path';\n\nconst ROOT = resolve('.');\nconst SELF = resolve(ROOT, 'scripts/verify-security-boundaries.mjs');\nconst violations = [];\nconst EXECUTION_RULES = [\n  { id: 'shell-true', pattern: /\\bshell\\s*:\\s*true\\b/g, message: 'shell execution must be explicitly disabled' },\n  { id: 'eval', pattern: /\\beval\\s*\\(/g, message: 'eval() is forbidden' },\n  { id: 'new-function', pattern: /\\bnew\\s+Function\\s*\\(/g, message: 'dynamic Function construction is forbidden' },\n  { id: 'function-constructor', pattern: /(?<![\\w$])Function\\s*\\(/g, message: 'Function() construction is forbidden' },\n  { id: 'vm-script', pattern: /\\bvm\\.Script\\b|\\bvm\\.(?:runInThisContext|runInNewContext|runInContext)\\s*\\(/g, message: 'dynamic vm execution is forbidden' },\n  { id: 'child-process-exec', pattern: /(?:\\bchild_process\\s*\\.\\s*)?(?<!\\.)\\b(?:exec|execSync)\\s*\\(/g, message: 'shell-oriented child_process exec is forbidden' },\n];\nconst PACKAGE_DEPENDENCIES = {\n  'cubes/safe-path-resolver-containment-boundary/src/index.js': {},\n  'cubes/runtime-capability-inspector/src/index.js': {},\n  'cubes/bounded-file-content-reader-safe-content-access/src/index.js': { '@sovereign/safe-path-resolver': '0.1.0' },\n  'cubes/directory-walker-bounded-tree-traversal/src/index.js': { '@sovereign/safe-path-resolver': '0.1.0' },\n  'cubes/filesystem-metadata-stat-normalizer/src/index.js': { '@sovereign/safe-path-resolver': '0.1.0' },\n  'cubes/safe-file-quarantine-delete/src/index.js': { '@sovereign/safe-path-resolver': '0.1.0' },\n};\nfunction walk(dir) {\n  const files = [];\n  for (const entry of readdirSync(dir, { withFileTypes: true })) {\n    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.artifacts') continue;\n    const full = join(dir, entry.name);\n    if (entry.isDirectory()) files.push(...walk(full));\n    else files.push(full);\n  }\n  return files;\n}\nfunction reportMatches(file, text) {\n  const lines = text.split(/\\r?\\n/);\n  for (const rule of EXECUTION_RULES) {\n    rule.pattern.lastIndex = 0;\n    let match;\n    while ((match = rule.pattern.exec(text)) !== null) {\n      const line = text.slice(0, match.index).split(/\\r?\\n/).length;\n      violations.push({ file: relative(ROOT, file), line, rule: rule.id, message: rule.message, source: lines[line - 1]?.trim() ?? '' });\n    }\n  }\n}\nfor (const root of [resolve(ROOT, 'scripts'), resolve(ROOT, 'cubes')]) {\n  if (!existsSync(root)) continue;\n  for (const file of walk(root)) {\n    if (resolve(file) === SELF) continue;\n    if (root.endsWith('cubes')) {\n      const normalized = file.replaceAll('\\\\', '/');\n      if (!normalized.startsWith(resolve(ROOT, 'cubes').replaceAll('\\\\', '/') + '/') || !normalized.includes('/src/')) continue;\n      if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;\n    } else if (!file.endsWith('.mjs') && !file.endsWith('.js')) continue;\n    reportMatches(file, readFileSync(file, 'utf8'));\n  }\n}\nfor (const [source, expectedDependencies] of Object.entries(PACKAGE_DEPENDENCIES)) {\n  const cubeDir = source.slice(0, source.indexOf('/src/'));\n  const packageDir = resolve(ROOT, 'packages', cubeDir.replace(/^.*\\//, '').replace(/-v0-1$/, ''));\n  const catalog = JSON.parse(readFileSync(resolve(ROOT, 'scripts/package-catalog.json'), 'utf8'));\n  const entry = Object.values(catalog).find((spec) => spec?.source === source);\n  if (!entry) { violations.push({ file: source, line: 1, rule: 'package-catalog-entry', message: 'package catalog entry missing', source }); continue; }\n  const packageJsonPath = resolve(ROOT, entry.packageDir, 'package.json');\n  if (!existsSync(packageJsonPath)) { violations.push({ file: relative(ROOT, packageJsonPath), line: 1, rule: 'package-manifest-missing', message: 'qualified package manifest is missing', source: entry.packageDir }); continue; }\n  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));\n  if (JSON.stringify(pkg.dependencies ?? {}) !== JSON.stringify(expectedDependencies)) violations.push({ file: relative(ROOT, packageJsonPath), line: 1, rule: 'package-runtime-dependencies', message: 'runtime dependencies do not match the explicit package contract', source: JSON.stringify(pkg.dependencies ?? {}) });\n  for (const field of ['devDependencies', 'peerDependencies', 'optionalDependencies']) if (pkg[field] && Object.keys(pkg[field]).length > 0) violations.push({ file: relative(ROOT, packageJsonPath), line: 1, rule: 'package-development-dependencies', message: \`\${field} must be absent from public cube packages\`, source: JSON.stringify(pkg[field]) });\n  if (pkg.scripts && Object.keys(pkg.scripts).length > 0) violations.push({ file: relative(ROOT, packageJsonPath), line: 1, rule: 'package-no-scripts', message: 'public package must not ship development scripts', source: JSON.stringify(pkg.scripts) });\n}\nif (violations.length) {\n  console.error('[security-verify] SECURITY BOUNDARY VIOLATIONS');\n  for (const violation of violations) {\n    console.error(\`- \${violation.file}:\${violation.line} [\${violation.rule}] \${violation.message}\`);\n    if (violation.source) console.error(\`  \${violation.source}\`);\n  }\n  process.exitCode = 1;\n} else {\n  console.log('[security-verify] no forbidden dynamic execution, shell-oriented exec, or public-package dependency boundary violations found');\n  console.log('[security-verify] ALL SECURITY BOUNDARY CHECKS PASSED');\n}\n`, 'utf8');
}

function updateCatalog() {
  const path = resolve(ROOT, 'scripts/package-catalog.json');
  const catalog = readJson(path);
  for (const [slug, source] of CANDIDATES) {
    const [, spec] = findSpec(catalog, source);
    spec.name = `@sovereign/${slug}`;
    spec.version = VERSION;
    spec.packageDir = `packages/${slug}`;
    spec.status = 'TECHNICALLY_READY';
    spec.reason = 'packaged with explicit @sovereign/safe-path-resolver runtime dependency, declaration-exact, out-of-tree verified';
  }
  writeJson(path, catalog);
}

function updateMatrix() {
  const path = resolve(ROOT, 'docs/release/PACKAGE_QUALIFICATION_MATRIX-V0.1.md');
  let text = readFileSync(path, 'utf8');
  text = text.replace('| TECHNICALLY_READY | 73 |', '| TECHNICALLY_READY | 77 |');
  text = text.replace('| CONDITIONAL | 4 |', '| CONDITIONAL | 0 |');
  const lines = text.split('\n');
  for (const [slug] of CANDIDATES) {
    const prefix = `| ${slug} |`;
    const index = lines.findIndex((line) => line.startsWith(prefix) && line.includes('| CONDITIONAL |'));
    if (index === -1) fail(`qualification matrix row not found for ${slug}`);
    lines[index] = `| ${slug} | TECHNICALLY_READY | @sovereign/${slug} | packaged, explicit @sovereign/safe-path-resolver@0.1.0 runtime dependency, declaration-exact, out-of-tree verified |`;
  }
  writeFileSync(path, lines.join('\n'), 'utf8');
}

function updateControl() {
  const path = resolve(ROOT, 'PROJECT_CONTROL.md');
  let text = readFileSync(path, 'utf8');
  text = text.replace('The current reported Node packaging wave contains **74 package entries representing 73 unique Cube sources**,', 'The current reported Node packaging wave contains **78 package entries representing 77 unique Cube sources**,');
  const marker = '## Continuity and non-destructive evolution';
  const note = '- Safe-path-resolver dependency boundary qualification: **4 formerly CONDITIONAL Cubes now declare `@sovereign/safe-path-resolver@0.1.0` explicitly**, with dedicated package, declaration, reproducibility, security, and out-of-tree verification.\n\n';
  if (!text.includes('4 formerly CONDITIONAL Cubes now declare')) text = text.replace(marker, `${note}${marker}`);
  text = text.replace('**Continue qualification and hardening of existing standalone library candidates, reconcile evidence, and prepare GitHub release artifacts for the authorized packages; optional free ecosystem publication may be enabled later as a separate release decision.**', '**Finish the expanded standalone-library verification wave, reconcile release evidence, and prepare GitHub release artifacts for the authorized packages; optional free ecosystem publication remains a separate release decision.**');
  writeFileSync(path, text, 'utf8');
}

function writeEvidence() {
  const path = resolve(ROOT, 'docs/release/SAFE_PATH_DEPENDENCY_BOUNDARY_MIGRATION_V0.1.md');
  writeFileSync(path, `# Safe Path Resolver Dependency Boundary Migration v0.1\n\n## Scope\n\nThe four previously CONDITIONAL filesystem Cubes that consumed the safe-path-resolver through a monorepo-relative runtime import now declare an explicit package dependency:\n\n- \\`@sovereign/safe-path-resolver@0.1.0\\`\n\n## Migrated Cubes\n\n| Cube | Package | Dependency |\n|---|---|---|\n| bounded-file-content-reader-safe-content-access | \\`@sovereign/bounded-file-content-reader-safe-content-access@0.1.0\\` | \\`@sovereign/safe-path-resolver@0.1.0\\` |\n| directory-walker-bounded-tree-traversal | \\`@sovereign/directory-walker-bounded-tree-traversal@0.1.0\\` | \\`@sovereign/safe-path-resolver@0.1.0\\` |\n| filesystem-metadata-stat-normalizer | \\`@sovereign/filesystem-metadata-stat-normalizer@0.1.0\\` | \\`@sovereign/safe-path-resolver@0.1.0\\` |\n| safe-file-quarantine-delete | \\`@sovereign/safe-file-quarantine-delete@0.1.0\\` | \\`@sovereign/safe-path-resolver@0.1.0\\` |\n\n## Boundary rule\n\nDistributed package runtime code must not import a sibling Cube by escaping the package boundary. The migrated source imports the published package identity instead. The monorepo test environment supplies the package through an explicit, local `node_modules` preparation seam; the package manifest remains the runtime dependency contract.\n\n## Verification\n\nThe migration is accepted only when the affected Cube tests, exact declaration surface, npm pack file allowlist, reproducible tarball checks, dependency contract checks, security boundary scan, and out-of-tree staging all pass.\n\n## Release state\n\nThese packages are technically ready; they are not automatically released or published. GitHub remains canonical and release authorization remains separate from technical qualification.\n`, 'utf8');
}

for (const [slug, source] of CANDIDATES) {
  const sourcePath = resolve(ROOT, source);
  const original = readFileSync(sourcePath, 'utf8');
  const legacy = '../../safe-path-resolver-containment-boundary/src/index.js';
  const matches = original.split(legacy).length - 1;
  if (matches !== 1) fail(`${source} expected exactly one legacy resolver import, found ${matches}`);
  writeFileSync(sourcePath, original.replace(legacy, RESOLVER), 'utf8');

  const packageDir = resolve(ROOT, 'packages', slug);
  mkdirSync(packageDir, { recursive: true });
  writeJson(resolve(packageDir, 'package.json'), packageManifest(slug));
  const cubeReadme = resolve(ROOT, source).replace(/src[/\\]index\.js$/, 'README.md');
  const packageReadme = resolve(packageDir, 'README.md');
  if (existsSync(cubeReadme)) copyFileSync(cubeReadme, packageReadme);
  else writeFileSync(packageReadme, `# @sovereign/${slug}\n\nStandalone Sovereign Cube.\n\nRuntime dependency: \\`@sovereign/safe-path-resolver@0.1.0\\`.\n`, 'utf8');
}

createPrepScript();
updateRootPackage();
updateCatalog();
updatePackageTooling();
updateReproducibilityVerifier();
updateSecurityVerifier();
updateMatrix();
updateControl();
writeEvidence();

console.log('[safe-path-migration] source imports migrated, package manifests created, qualification tooling expanded, matrix/control/evidence updated');
