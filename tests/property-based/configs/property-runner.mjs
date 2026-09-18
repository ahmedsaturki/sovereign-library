// tests/property-based/configs/property-runner.mjs
//
// Aggregator runner — invokes every *.prop.mjs in tests/property-based/properties/.
// Writes a JSON transcript per file under .hermes/phase3/property/.

import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const PROPS_DIR = join(REPO_ROOT, 'tests', 'property-based', 'properties');
const OUT_DIR = resolve(process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : '.hermes/phase3/property');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(PROPS_DIR).filter(f => f.endsWith('.prop.mjs') && f !== 'property-runner.mjs' && f !== 'property.mjs');
const summary = { started: new Date().toISOString(), files: [], total: 0, passed: 0, failed: 0 };

for (const f of files) {
  const path = join(PROPS_DIR, f);
  const transcript = join(OUT_DIR, basename(f, '.prop.mjs') + '.transcript');
  let stdout = '';
  try {
    stdout = execFileSync('node', ['--test', path], { stdio: 'pipe', encoding: 'utf8', timeout: 60_000 });
    summary.passed += 1;
  } catch (err) {
    stdout = (err.stdout?.toString?.() ?? '') + '\n' + (err.stderr?.toString?.() ?? '');
    summary.failed += 1;
  }
  summary.total += 1;
  writeFileSync(transcript, stdout);
  summary.files.push({ file: f, transcript });
}

summary.finished = new Date().toISOString();
writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`property: ${summary.total} files, ${summary.passed} passed, ${summary.failed} failed`);
process.exit(summary.failed > 0 ? 1 : 0);