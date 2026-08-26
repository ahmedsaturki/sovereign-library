import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const configPath = resolve('jsconfig.declarations.json');
const outDir = resolve('.artifacts/declarations');
const toolsDir = resolve('.artifacts/declaration-tools');
const typeRoots = resolve(toolsDir, 'node_modules/@types');
const expectedFiles = {
  safePathResolver: resolve('.artifacts/declarations/cubes/safe-path-resolver-containment-boundary/src/index.d.ts'),
  runtimeCapability: resolve('.artifacts/declarations/cubes/runtime-capability-inspector/src/index.d.ts'),
};

const expectedExports = {
  safePathResolver: new Set([
    'SafePathResolverError', 'normalizePath', 'resolvePath', 'isContained',
    'resolveContained', 'canonicalizePath', 'comparePaths', 'serializeReport', 'parseReport',
    'SAFE_PATH_RESOLVER_FORMAT', 'SAFE_PATH_RESOLVER_LIMITS',
  ]),
  runtimeCapability: new Set([
    'RuntimeCapabilityError', 'inspectRuntime', 'evaluateRuntimeRequirements',
    'serializeRuntimeReport', 'parseRuntimeReport', 'RUNTIME_CAPABILITY_FORMAT',
    'RUNTIME_OS_FAMILIES', 'RUNTIME_ARCHITECTURES',
  ]),
};

function extractDeclarationExports(text) {
  const found = new Set();
  const patterns = [
    /export\s+(?:declare\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
    /export\s*\{([^}]+)\}/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (pattern.source.startsWith('export\\s*\\{')) {
        for (const item of match[1].split(',')) {
          const name = item.trim().split(/\s+as\s+/)[0];
          if (name) found.add(name);
        }
      } else {
        found.add(match[1]);
      }
    }
  }
  return found;
}

function assertExactExports(label, file, expected) {
  if (!existsSync(file)) throw new Error(`missing generated declaration: ${label}`);
  const exports = extractDeclarationExports(readFileSync(file, 'utf8'));
  const missing = [...expected].filter((name) => !exports.has(name));
  const unexpected = [...exports].filter((name) => !expected.has(name));
  if (missing.length || unexpected.length) {
    throw new Error(`declaration surface mismatch for ${label}; missing=[${missing.join(',')}] unexpected=[${unexpected.join(',')}]`);
  }
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (config?.compilerOptions?.allowJs !== true) throw new Error('declaration config must enable allowJs');
if (config?.compilerOptions?.declaration !== true) throw new Error('declaration config must enable declaration');
if (config?.compilerOptions?.emitDeclarationOnly !== true) throw new Error('declaration config must enable emitDeclarationOnly');
if (!Array.isArray(config.include) || config.include.length !== 2) throw new Error('declaration pilot must contain exactly two sources');

rmSync(outDir, { recursive: true, force: true });
rmSync(toolsDir, { recursive: true, force: true });

const onWindows = process.platform === 'win32';
const npm = onWindows ? 'npm.cmd' : 'npm';
const install = spawnSync(npm, [
  'install',
  '--no-save',
  '--no-package-lock',
  '--ignore-scripts',
  '--prefix', toolsDir,
  'typescript@7.0.2',
  '@types/node@26.2.0',
], { stdio: 'inherit', shell: onWindows });

if (install.error) throw install.error;
if (install.status !== 0) throw new Error(`declaration tool installation exited with status ${install.status}`);

const tsc = resolve(toolsDir, 'node_modules/typescript/bin/tsc');
if (!existsSync(tsc)) throw new Error(`missing pinned TypeScript compiler: ${tsc}`);
if (!existsSync(typeRoots)) throw new Error(`missing pinned Node type roots: ${typeRoots}`);

const result = spawnSync(process.execPath, [
  tsc,
  '--project', configPath,
  '--typeRoots', typeRoots,
  '--pretty', 'false',
], { stdio: 'inherit', shell: false });

try {
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`declaration compiler exited with status ${result.status}`);

  assertExactExports('Safe Path Resolver', expectedFiles.safePathResolver, expectedExports.safePathResolver);
  assertExactExports('Runtime Capability Inspector', expectedFiles.runtimeCapability, expectedExports.runtimeCapability);

  console.log('[declarations] pilot generation and amended frozen public-surface verification passed');
} finally {
  rmSync(toolsDir, { recursive: true, force: true });
}
