import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const configPath = resolve('jsconfig.declarations.json');
const outDir = resolve('.artifacts/declarations');
const expected = [
  resolve('.artifacts/declarations/cubes/safe-path-resolver-containment-boundary/src/index.d.ts'),
  resolve('.artifacts/declarations/cubes/runtime-capability-inspector/src/index.d.ts'),
];

const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (config?.compilerOptions?.allowJs !== true) throw new Error('declaration config must enable allowJs');
if (config?.compilerOptions?.declaration !== true) throw new Error('declaration config must enable declaration');
if (config?.compilerOptions?.emitDeclarationOnly !== true) throw new Error('declaration config must enable emitDeclarationOnly');
if (!Array.isArray(config.include) || config.include.length !== 2) throw new Error('declaration pilot must contain exactly two sources');

rmSync(outDir, { recursive: true, force: true });

const npm = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npm, [
  '--yes',
  '-p', 'typescript@7.0.2',
  '-p', '@types/node@26.2.0',
  'tsc',
  '--project', configPath,
], { stdio: 'inherit', shell: false });

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`declaration compiler exited with status ${result.status}`);

for (const file of expected) {
  if (!existsSync(file)) throw new Error(`missing generated declaration: ${file}`);
  const text = readFileSync(file, 'utf8');
  if (!/\bexport\b/.test(text)) throw new Error(`generated declaration has no exports: ${file}`);
}

console.log('[declarations] pilot generation and basic surface verification passed');
