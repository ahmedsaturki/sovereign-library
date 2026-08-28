#!/usr/bin/env node
// package-catalog-stage.mjs
//
// Declarative package staging driven by PACKAGE_CATALOG.json.
// For an eligible cube it:
//   1. reads the cube entry from the catalog (id, source, expected exports)
//   2. copies source into packages/<id>/src/index.js
//   3. emits packages/<id>/dist/index.d.ts via pinned typescript
//   4. asserts the declared export surface matches exactly
//   5. copies LICENSE + NOTICE
//
// This generalizes scripts/package-stage.mjs (which was hardcoded for the two
// first-batch candidates) to the full eligible catalog. No cube is staged
// unless it is present in PACKAGE_CATALOG.json with hasTest && hasReadme.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runNpm } from './npm-cli.mjs';

const ROOT = resolve('.');
const TOOLS_DIR = resolve('.artifacts/package-tools');
const CATALOG_PATH = resolve('PACKAGE_CATALOG.json');

const TSC_VERSION = 'typescript@7.0.2';
const TYPES_NODE_VERSION = '@types/node@26.2.0';

function fail(message) {
  throw new Error(`[catalog-stage] ${message}`);
}

function extractDeclarationExports(text) {
  const found = new Set();
  const declarations = /export\s+(?:declare\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = declarations.exec(text)) !== null) found.add(match[1]);
  const named = /export\s*\{([^}]+)\}/g;
  while ((match = named.exec(text)) !== null) {
    for (const item of match[1].split(',')) {
      const name = item.trim().split(/\s+as\s+/)[0];
      if (name) found.add(name);
    }
  }
  return found;
}

function assertExactExports(file, expected) {
  const actual = extractDeclarationExports(readFileSync(file, 'utf8'));
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((name) => !actual.has(name));
  const unexpected = [...actual].filter((name) => !expectedSet.has(name));
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

function main() {
  const id = process.argv[2];
  if (!id) fail('usage: node scripts/package-catalog-stage.mjs <cube-id>');

  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const entry = catalog.cubes.find((c) => c.id === id);
  if (!entry) fail(`cube id not found in ${CATALOG_PATH}: ${id}`);
  if (entry.classification === 'CONDITIONAL') {
    fail(`cube ${id} is CONDITIONAL (monorepo-path dependency); remediate before staging. See PACKAGE_CATALOG.json conditionalDependency.remediation`);
  }
  if (!entry.hasTest || !entry.hasReadme) {
    fail(`cube ${id} is not eligible (requires test + README): hasTest=${entry.hasTest} hasReadme=${entry.hasReadme}`);
  }

  const packageId = entry.packageId || entry.id;
  const packageDir = resolve('packages', packageId);
  const source = resolve(entry.source);
  if (!existsSync(source)) fail(`source cube is missing: ${source}`);

  const dist = resolve(packageDir, 'dist');
  const src = resolve(packageDir, 'src');
  rmSync(src, { recursive: true, force: true });
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(src, { recursive: true });
  mkdirSync(dist, { recursive: true });

  copyFileSync(source, resolve(src, 'index.js'));
  copyFileSync(resolve(ROOT, 'LICENSE'), resolve(packageDir, 'LICENSE'));
  copyFileSync(resolve(ROOT, 'NOTICE'), resolve(packageDir, 'NOTICE'));

  rmSync(TOOLS_DIR, { recursive: true, force: true });
  mkdirSync(TOOLS_DIR, { recursive: true });
  const install = runNpm([
    'install', '--no-save', '--no-package-lock', '--ignore-scripts', '--prefix', TOOLS_DIR,
    TSC_VERSION, TYPES_NODE_VERSION,
  ]);
  if (install.status !== 0) fail(`tool installation exited with status ${install.status}`);
  const tsc = resolve(TOOLS_DIR, 'node_modules/typescript/bin/tsc');
  const typeRoots = resolve(TOOLS_DIR, 'node_modules/@types');
  if (!existsSync(tsc) || !existsSync(typeRoots)) fail('pinned declaration toolchain was not installed');

  const configPath = writeDeclarationConfig(id, resolve(src, 'index.js'), dist);
  const result = spawnSync(process.execPath, [tsc, '--project', configPath, '--typeRoots', typeRoots, '--pretty', 'false'], { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`declaration compiler exited with status ${result.status}`);
  const declaration = resolve(dist, 'index.d.ts');
  if (!existsSync(declaration)) fail(`missing declaration output: ${declaration}`);
  assertExactExports(declaration, entry.exportedNames);
  console.log(`[catalog-stage] staged ${id} with exact declaration surface (${entry.exportedNames.length} exports)`);
}

try {
  main();
} finally {
  rmSync(TOOLS_DIR, { recursive: true, force: true });
}
