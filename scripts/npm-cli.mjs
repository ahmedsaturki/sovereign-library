import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const NODE_DIR = dirname(process.execPath);
const NPM_CLI_CANDIDATES = [
  resolve(NODE_DIR, 'node_modules/npm/bin/npm-cli.js'),
  resolve(NODE_DIR, '../lib/node_modules/npm/bin/npm-cli.js'),
];

export function resolveNpmCli() {
  const cli = NPM_CLI_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!cli) throw new Error(`unable to locate bundled npm CLI under ${NODE_DIR}`);
  return cli;
}

export function runNpm(args, options = {}) {
  const result = spawnSync(process.execPath, [resolveNpmCli(), ...args], {
    cwd: options.cwd,
    stdio: options.stdio ?? 'inherit',
    encoding: options.encoding,
    shell: false,
  });
  if (result.error) throw result.error;
  return result;
}
