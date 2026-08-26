import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const DEFAULT_TIMEOUT_MS = 30_000;

function parseTestFiles(script) {
  const marker = 'node --test --test-timeout=10000 ';
  const start = script.indexOf(marker);
  if (start < 0) throw new Error('Unable to locate the canonical npm test command');
  return script.slice(start + marker.length).trim().split(/\s+/).filter(Boolean);
}

function runFile(file, timeoutMs) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, ['--test', '--test-timeout=10000', file], {
      stdio: 'inherit',
      windowsHide: true,
    });
    let timer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref();
      reject(new Error(`TEST_FILE_TIMEOUT:${file}:${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref();

    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      const elapsed = Date.now() - started;
      if (code === 0) {
        console.log(`\n[bounded-test] PASS ${file} (${elapsed}ms)`);
        resolve();
        return;
      }
      reject(new Error(`TEST_FILE_FAILED:${file}:code=${code}:signal=${signal ?? 'none'}:elapsed=${elapsed}ms`));
    });
  });
}

const timeoutMs = Number(process.env.SOVEREIGN_TEST_FILE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 300_000) {
  throw new Error('SOVEREIGN_TEST_FILE_TIMEOUT_MS must be an integer between 1000 and 300000');
}

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const files = parseTestFiles(pkg.scripts?.test ?? '');

console.log(`[bounded-test] ${files.length} test files; per-file timeout=${timeoutMs}ms`);
for (const file of files) {
  console.log(`\n[bounded-test] START ${file}`);
  await runFile(file, timeoutMs);
}
console.log('\n[bounded-test] ALL PASS');
