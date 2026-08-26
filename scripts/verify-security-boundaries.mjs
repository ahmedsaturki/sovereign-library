import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const ROOT = resolve('.');
const SELF = resolve(ROOT, 'scripts/verify-security-boundaries.mjs');
const violations = [];
const EXECUTION_RULES = [
  { id: 'shell-true', pattern: /\bshell\s*:\s*true\b/g, message: 'shell execution must be explicitly disabled' },
  { id: 'eval', pattern: /\beval\s*\(/g, message: 'eval() is forbidden' },
  { id: 'new-function', pattern: /\bnew\s+Function\s*\(/g, message: 'dynamic Function construction is forbidden' },
  { id: 'function-constructor', pattern: /(?<![\w$])Function\s*\(/g, message: 'Function() construction is forbidden' },
  { id: 'vm-script', pattern: /\bvm\.Script\b|\bvm\.(?:runInThisContext|runInNewContext|runInContext)\s*\(/g, message: 'dynamic vm execution is forbidden' },
  { id: 'child-process-exec', pattern: /(?:\bchild_process\s*\.\s*)?(?<!\.)\b(?:exec|execSync)\s*\(/g, message: 'shell-oriented child_process exec is forbidden' },
];

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

function reportMatches(file, text) {
  const lines = text.split(/\r?\n/);
  for (const rule of EXECUTION_RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      violations.push({
        file: relative(ROOT, file),
        line,
        rule: rule.id,
        message: rule.message,
        source: lines[line - 1]?.trim() ?? '',
      });
    }
  }
}

const scanRoots = [resolve(ROOT, 'scripts'), resolve(ROOT, 'cubes')];
for (const root of scanRoots) {
  if (!existsSync(root)) continue;
  for (const file of walk(root)) {
    if (resolve(file) === SELF) continue;
    if (root.endsWith('cubes')) {
      const sourceMarker = `${resolve(ROOT, 'cubes')}${process.platform === 'win32' ? '\\' : '/'}\n`;
      const normalized = file.replaceAll('\\', '/');
      if (!normalized.startsWith(resolve(ROOT, 'cubes').replaceAll('\\', '/') + '/') || !normalized.includes('/src/')) continue;
      if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;
    } else if (!file.endsWith('.mjs') && !file.endsWith('.js')) {
      continue;
    }
    reportMatches(file, readFileSync(file, 'utf8'));
  }
}

for (const packageName of ['safe-path-resolver', 'runtime-capability-inspector']) {
  const packageJsonPath = resolve(ROOT, 'packages', packageName, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (pkg[field] && Object.keys(pkg[field]).length > 0) {
      violations.push({ file: relative(ROOT, packageJsonPath), line: 1, rule: 'package-dependency-free', message: `${field} must be absent for a dependency-free public cube`, source: JSON.stringify(pkg[field]) });
    }
  }
  if (pkg.scripts && Object.keys(pkg.scripts).length > 0) {
    violations.push({ file: relative(ROOT, packageJsonPath), line: 1, rule: 'package-no-scripts', message: 'public package must not ship development scripts', source: JSON.stringify(pkg.scripts) });
  }
}

if (violations.length) {
  console.error('[security-verify] SECURITY BOUNDARY VIOLATIONS');
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
    if (violation.source) console.error(`  ${violation.source}`);
  }
  process.exitCode = 1;
} else {
  console.log('[security-verify] no forbidden dynamic execution, shell-oriented exec, or public-package dependency boundary violations found');
  console.log('[security-verify] ALL SECURITY BOUNDARY CHECKS PASSED');
}
