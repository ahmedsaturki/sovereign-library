// Helper invoked by prepare-authorized-release-artifacts.mjs to run `npm pack`
// in a way that is robust across Windows (npm.cmd) and POSIX (npm) without
// relying on the parent process's shell resolution.
//
// Usage: node scripts/npm-pack-helper.mjs <packageDir> <outDir>
// Prints the JSON stdout produced by `npm pack --json` to stdout.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const packageDir = resolve(process.argv[2]);
const outDir = resolve(process.argv[3]);

const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmBin, ['pack', packageDir, '--pack-destination', outDir, '--json'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'inherit'],
  windowsHide: true,
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(`[npm-pack-helper] failed to spawn npm: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
process.stdout.write(result.stdout ?? '');
