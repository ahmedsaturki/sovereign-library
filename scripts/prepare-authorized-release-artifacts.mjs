import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve, basename } from 'node:path';

const ROOT = resolve('.');
const OUT = resolve(ROOT, process.env.SOVEREIGN_RELEASE_ARTIFACT_DIR || '.artifacts/authorized-release-v0.1');
const PACKAGES = [
  {
    id: 'safe-path-resolver',
    path: 'packages/safe-path-resolver',
    name: '@sovereign/safe-path-resolver',
    version: '0.1.0',
  },
  {
    id: 'runtime-capability-inspector',
    path: 'packages/runtime-capability-inspector',
    name: '@sovereign/runtime-capability-inspector',
    version: '0.1.0',
  },
];

function fail(message) {
  throw new Error(`[release-artifacts] ${message}`);
}

function run(command, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', rejectPromise);
    child.once('close', (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`[release-artifacts] command failed (${code}): ${command} ${args.join(' ')}\n${stderr}`));
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

async function sha256(file) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', rejectPromise);
    stream.once('end', () => resolvePromise(hash.digest('hex')));
  });
}

function npmExecutable() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const records = [];
  for (const pkg of PACKAGES) {
    const packageDir = resolve(ROOT, pkg.path);
    const result = await run(npmExecutable(), ['pack', packageDir, '--pack-destination', OUT, '--json'], ROOT);
    let packed;
    try {
      packed = JSON.parse(result.stdout);
    } catch {
      fail(`npm pack returned non-JSON output for ${pkg.id}`);
    }
    if (!Array.isArray(packed) || packed.length !== 1 || typeof packed[0]?.filename !== 'string') {
      fail(`unexpected npm pack result for ${pkg.id}`);
    }
    const filename = basename(packed[0].filename);
    const tarball = join(OUT, filename);
    records.push({
      id: pkg.id,
      name: pkg.name,
      version: pkg.version,
      packagePath: pkg.path,
      tarball: filename,
      sha256: await sha256(tarball),
      sizeBytes: packed[0].size,
      shasum: packed[0].shasum || null,
    });
  }

  const manifest = {
    format: 'SOVEREIGN-AUTHORIZED-RELEASE-ARTIFACTS-V0.1',
    preparedAt: new Date().toISOString(),
    sourceCommit: process.env.GITHUB_SHA || 'unknown',
    workflowRunId: process.env.GITHUB_RUN_ID || null,
    repository: process.env.GITHUB_REPOSITORY || 'ahmedsaturki/sovereign-library',
    branch: process.env.GITHUB_REF_NAME || null,
    publication: 'NOT_PUBLISHED',
    packages: records,
  };

  await writeFile(join(OUT, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(
    join(OUT, 'SHA256SUMS.txt'),
    `${records.map((record) => `${record.sha256}  ${record.tarball}`).join('\n')}\n`,
    'utf8',
  );

  console.log(JSON.stringify(manifest, null, 2));
  console.log('[release-artifacts] authorized release artifacts prepared without publication');
}

await main();
