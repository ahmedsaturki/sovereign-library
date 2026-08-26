import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const violations = [];

function fail(file, rule, message, source = '') {
  violations.push({ file, rule, message, source });
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`invalid JSON at ${path}: ${error.message}`);
  }
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.artifacts') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const packagePaths = [
  resolve(ROOT, 'packages/safe-path-resolver/package.json'),
  resolve(ROOT, 'packages/runtime-capability-inspector/package.json'),
];

for (const packagePath of packagePaths) {
  const pkg = readJson(packagePath);
  const label = packagePath.slice(ROOT.length + 1).replaceAll('\\', '/');
  if (pkg.private === true) fail(label, 'public-package-private', 'publishable candidates must not be private');
  if (pkg.publishConfig) fail(label, 'publish-config', 'publishConfig is forbidden until explicit publication authorization exists', JSON.stringify(pkg.publishConfig));
  if (pkg.scripts) {
    const scripts = Object.keys(pkg.scripts);
    if (scripts.length) fail(label, 'package-scripts', 'public candidate packages must not ship package scripts', JSON.stringify(pkg.scripts));
  }
  if (pkg.dependencies || pkg.optionalDependencies || pkg.peerDependencies) {
    const fields = {};
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      if (pkg[field] && Object.keys(pkg[field]).length) fields[field] = pkg[field];
    }
    if (Object.keys(fields).length) fail(label, 'runtime-dependencies', 'runtime dependency declarations are not allowed for the first zero-runtime-dependency batch', JSON.stringify(fields));
  }
}

const configCandidates = [
  resolve(ROOT, 'package.json'),
  resolve(ROOT, '.npmrc'),
  ...(existsSync(resolve(ROOT, '.github')) ? walk(resolve(ROOT, '.github')) : []),
];

for (const file of configCandidates) {
  if (!existsSync(file)) continue;
  const rel = file.slice(ROOT.length + 1).replaceAll('\\', '/');
  if (!(rel === 'package.json' || rel === '.npmrc' || rel.startsWith('.github/'))) continue;
  const text = readFileSync(file, 'utf8');
  if (/\bnpm\s+publish\b/i.test(text)) fail(rel, 'automatic-publish', 'npm publish is forbidden in repository automation/configuration', text.match(/npm\s+publish[^\n]*/i)?.[0] ?? 'npm publish');
  if (/\bNPM_TOKEN\b|NODE_AUTH_TOKEN|npm_config_.*token/i.test(text)) fail(rel, 'registry-credentials', 'registry credential injection is forbidden before explicit release authorization', text.match(/(?:NPM_TOKEN|NODE_AUTH_TOKEN|npm_config_[^\s=]*)/i)?.[0] ?? 'registry credential');
  if (/publishConfig\s*[:=]/i.test(text)) fail(rel, 'publish-config', 'publishConfig is forbidden before explicit release authorization');
  if (/registry\s*=\s*https?:\/\//i.test(text)) fail(rel, 'registry-config', 'explicit registry configuration is forbidden before release authorization');
}

const rootPackage = readJson(resolve(ROOT, 'package.json'));
if (rootPackage.private !== true) fail('package.json', 'root-package-private', 'repository root package must remain private while package release is gated');

if (violations.length) {
  console.error('[publication-guard] PUBLICATION GUARD VIOLATIONS');
  for (const violation of violations) {
    console.error(`- ${violation.file} [${violation.rule}] ${violation.message}`);
    if (violation.source) console.error(`  ${violation.source}`);
  }
  process.exitCode = 1;
} else {
  console.log('[publication-guard] candidates remain packageable but publication-disabled');
  console.log('[publication-guard] no publish command, registry credential, publishConfig, or registry override found');
  console.log('[publication-guard] ALL PUBLICATION GUARD CHECKS PASSED');
}
