import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync, cpSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runNpm } from './npm-cli.mjs';
import { readFileSync as readJson } from 'node:fs';

const ROOT = resolve('.');
const TOOLS_DIR = resolve('.artifacts/package-tools');
const CATALOG_PATH = resolve('scripts/package-catalog.json');

function fail(message) {
  throw new Error(`[package-stage] ${message}`);
}

function loadCatalog() {
  if (!existsSync(CATALOG_PATH)) fail(`missing package catalog: ${CATALOG_PATH}`);
  const data = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  return data;
}

function extractDeclarationExports(text) {
  const found = new Set();
  const declarations = /export\s+(?:declare\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = declarations.exec(text)) !== null) found.add(match[1]);
  const named = /export\s*\{([^}]+)\}/g;
  while ((match = named.exec(text)) !== null) {
    for (const item of match[1].split(',')) {
      const parts = item.trim().split(/\s+as\s+/);
      const name = (parts[1] || parts[0]).trim();
      if (name && name !== 'default') found.add(name.split(/\s+/)[0]);
    }
  }
  return found;
}

function assertExactExports(file, expected) {
  const actual = extractDeclarationExports(readFileSync(file, 'utf8'));
  const missing = [...expected].filter((name) => !actual.has(name));
  const unexpected = [...actual].filter((name) => !expected.has(name));
  if (missing.length || unexpected.length) {
    fail(`declaration surface mismatch; missing=[${missing.join(',')}] unexpected=[${unexpected.join(',')}]`);
  }
}

function writeDeclarationConfig(target, source, outDir) {
  const config = {
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      declaration: true,
      emitDeclarationOnly: true,
      declarationMap: false,
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      types: ['node'],
      strict: false,
      skipLibCheck: true,
      outDir,
      rootDir: dirname(source),
    },
    include: [source],
  };
  const configPath = resolve('.artifacts/package-declarations', `${target}.json`);
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return configPath;
}

function stageRuntimeDependencies(spec, catalog, packageDir) {
  const dependencies = spec.dependencies || {};
  if (Object.keys(dependencies).length === 0) return;
  const nodeModules = resolve(packageDir, 'node_modules');
  rmSync(nodeModules, { recursive: true, force: true });
  for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
    const dependencySpec = Object.values(catalog).find((candidate) => candidate.name === dependencyName && candidate.version === dependencyVersion);
    if (!dependencySpec) fail(`runtime dependency not found in catalog: ${dependencyName}@${dependencyVersion}`);
    const dependencySource = resolve(ROOT, dependencySpec.source);
    if (!existsSync(dependencySource)) fail(`runtime dependency source is missing: ${dependencySource}`);
    const parts = dependencyName.split('/');
    const dependencyRoot = parts[0].startsWith('@')
      ? resolve(nodeModules, parts[0], parts[1])
      : resolve(nodeModules, dependencyName);
    mkdirSync(dependencyRoot, { recursive: true });
    const dependencySourceRoot = dirname(dependencySource);
    // Stage the dependency's runtime source at the package ROOT (index.js at
    // root) plus its generated declaration surface (index.d.ts at root). A plain
    // `main`/`types` package.json is resolved unambiguously by both tsc
    // (NodeNext/allowJs) and Node's runtime, unlike a nested exports map that
    // some resolution contexts skip for .js entrypoints.
    for (const entry of readdirSync(dependencySourceRoot)) {
      const full = resolve(dependencySourceRoot, entry);
      if (statSync(full).isDirectory()) cpSync(full, resolve(dependencyRoot, entry), { recursive: true });
      else if (entry.endsWith('.js') || entry.endsWith('.mjs') || entry.endsWith('.d.ts')) copyFileSync(full, resolve(dependencyRoot, entry));
    }
    const depDistSource = resolve(ROOT, dependencySpec.packageDir, 'dist', 'index.d.ts');
    if (existsSync(depDistSource)) copyFileSync(depDistSource, resolve(dependencyRoot, 'index.d.ts'));
    writeFileSync(resolve(dependencyRoot, 'package.json'), `${JSON.stringify({ name: dependencyName, version: dependencyVersion, type: 'module', main: 'index.js', types: 'index.d.ts' }, null, 2)}\n`, 'utf8');
  }
}

function main() {
  const candidate = process.argv[2];
  const catalog = loadCatalog();
  if (!candidate) {
    fail(`usage: node scripts/package-stage.mjs <${Object.keys(catalog).join('|')}>`);
  }
  const spec = catalog[candidate];
  if (!spec) fail(`unknown candidate: ${candidate}`);
  const packageDir = resolve(spec.packageDir);
  const source = resolve(spec.source);
  const expected = new Set(spec.expected || []);
  const dist = resolve(packageDir, 'dist');
  const src = resolve(packageDir, 'src');
  rmSync(src, { recursive: true, force: true });
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(src, { recursive: true });
  mkdirSync(dist, { recursive: true });
  if (!existsSync(source)) fail(`source cube is missing: ${source}`);
  const srcRoot = dirname(source);
  rmSync(src, { recursive: true, force: true });
  mkdirSync(src, { recursive: true });
  for (const entry of readdirSync(srcRoot)) {
    const full = resolve(srcRoot, entry);
    if (statSync(full).isDirectory()) {
      cpSync(full, resolve(src, entry), { recursive: true });
    } else if (entry.endsWith('.js') || entry.endsWith('.mjs') || entry.endsWith('.d.ts')) {
      copyFileSync(full, resolve(src, entry));
    }
  }
  copyFileSync(resolve(ROOT, 'LICENSE'), resolve(packageDir, 'LICENSE'));
  copyFileSync(resolve(ROOT, 'NOTICE'), resolve(packageDir, 'NOTICE'));
  const cubeReadme = resolve(ROOT, spec.source).replace(/src[/\\]index\.js$/, 'README.md');
  const pkgReadme = resolve(packageDir, 'README.md');
  if (existsSync(cubeReadme)) {
    copyFileSync(cubeReadme, pkgReadme);
  } else if (!existsSync(pkgReadme)) {
    writeFileSync(pkgReadme, `# ${spec.name}\n\n${spec.description}\n\n## Status\n\nTECHNICALLY_READY — publication deferred (GitHub-only distribution). See repository docs.\n`, 'utf8');
  }

  stageRuntimeDependencies(spec, catalog, packageDir);
  rmSync(TOOLS_DIR, { recursive: true, force: true });
  mkdirSync(TOOLS_DIR, { recursive: true });
  const install = runNpm([
    'install', '--no-save', '--no-package-lock', '--ignore-scripts', '--prefix', TOOLS_DIR,
    'typescript@7.0.2', '@types/node@26.2.0',
  ]);
  if (install.status !== 0) fail(`tool installation exited with status ${install.status}`);
  const tsc = resolve(TOOLS_DIR, 'node_modules/typescript/bin/tsc');
  const typeRoots = resolve(TOOLS_DIR, 'node_modules/@types');
  if (!existsSync(tsc) || !existsSync(typeRoots)) fail('pinned declaration toolchain was not installed');

  const configPath = writeDeclarationConfig(candidate, resolve(src, 'index.js'), dist);
  const result = spawnSync(process.execPath, [tsc, '--project', configPath, '--typeRoots', typeRoots, '--pretty', 'false'], { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`declaration compiler exited with status ${result.status}`);
  const declaration = resolve(dist, 'index.d.ts');
  if (!existsSync(declaration)) fail(`missing declaration output: ${declaration}`);
  assertExactExports(declaration, expected);
  console.log(`[package-stage] staged ${candidate} with exact declaration surface`);
}

try {
  main();
} finally {
  rmSync(TOOLS_DIR, { recursive: true, force: true });
}
