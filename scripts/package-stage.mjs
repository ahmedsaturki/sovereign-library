import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runNpm } from './npm-cli.mjs';

const ROOT = resolve('.');
const TOOLS_DIR = resolve('.artifacts/package-tools');
const STAGE = {
  'safe-path-resolver': {
    packageDir: resolve('packages/safe-path-resolver'),
    source: resolve('cubes/safe-path-resolver-containment-boundary/src/index.js'),
    expected: new Set([
      'SafePathResolverError', 'normalizePath', 'resolvePath', 'isContained',
      'resolveContained', 'canonicalizePath', 'comparePaths', 'serializeReport',
      'parseReport', 'SAFE_PATH_RESOLVER_FORMAT', 'SAFE_PATH_RESOLVER_LIMITS',
    ]),
  },
  'runtime-capability-inspector': {
    packageDir: resolve('packages/runtime-capability-inspector'),
    source: resolve('cubes/runtime-capability-inspector/src/index.js'),
    expected: new Set([
      'RuntimeCapabilityError', 'inspectRuntime', 'evaluateRuntimeRequirements',
      'serializeRuntimeReport', 'parseRuntimeReport', 'RUNTIME_CAPABILITY_FORMAT',
      'RUNTIME_OS_FAMILIES', 'RUNTIME_ARCHITECTURES',
    ]),
  },
};

function fail(message) {
  throw new Error(`[package-stage] ${message}`);
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
  const candidate = process.argv[2];
  if (!candidate || !Object.hasOwn(STAGE, candidate)) {
    fail(`usage: node scripts/package-stage.mjs <${Object.keys(STAGE).join('|')}>`);
  }
  const spec = STAGE[candidate];
  const dist = resolve(spec.packageDir, 'dist');
  const src = resolve(spec.packageDir, 'src');
  rmSync(src, { recursive: true, force: true });
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(src, { recursive: true });
  mkdirSync(dist, { recursive: true });
  if (!existsSync(spec.source)) fail(`source cube is missing: ${spec.source}`);
  copyFileSync(spec.source, resolve(src, 'index.js'));
  copyFileSync(resolve(ROOT, 'LICENSE'), resolve(spec.packageDir, 'LICENSE'));
  copyFileSync(resolve(ROOT, 'NOTICE'), resolve(spec.packageDir, 'NOTICE'));

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
  assertExactExports(declaration, spec.expected);
  console.log(`[package-stage] staged ${candidate} with exact declaration surface`);
}

try {
  main();
} finally {
  rmSync(TOOLS_DIR, { recursive: true, force: true });
}
