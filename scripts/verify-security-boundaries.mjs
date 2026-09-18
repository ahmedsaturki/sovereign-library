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

  // Only flag shell-oriented exec/execSync when the source explicitly
  // addresses Node's child_process module. Generic `exec(...)` methods
  // are valid for other APIs (for example SQLite's DatabaseSync.exec),
  // and must not be treated as shell execution.
  const childProcessPatterns = [
    /\b(?:node:)?child_process\s*\.\s*(?:exec|execSync)\s*\(/g,
    /\brequire\(\s*['"](?:node:)?child_process['"]\s*\)\s*\.\s*(?:exec|execSync)\s*\(/g,
  ];

  const importedAliases = new Set();
  const importRe = /import\s*\{([^}]+)\}\s*from\s*['"](?:node:)?child_process['"]/g;
  let importMatch;
  while ((importMatch = importRe.exec(text)) !== null) {
    for (const specifier of importMatch[1].split(',')) {
      const parts = specifier.trim().split(/\s+as\s+/i);
      const imported = parts[0]?.trim();
      const local = parts[1]?.trim() || imported;
      if (imported === 'exec' || imported === 'execSync') importedAliases.add(local);
    }
  }

  const requireRe = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*['"](?:node:)?child_process['"]\s*\)/g;
  let requireMatch;
  while ((requireMatch = requireRe.exec(text)) !== null) {
    for (const specifier of requireMatch[1].split(',')) {
      const parts = specifier.trim().split(/\s*:\s*/);
      const imported = parts[0]?.trim();
      const local = parts[1]?.trim() || imported;
      if (imported === 'exec' || imported === 'execSync') importedAliases.add(local);
    }
  }

  for (const alias of importedAliases) {
    childProcessPatterns.push(new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\(`, 'g'));
  }

  for (const pattern of childProcessPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      violations.push({
        file: relative(ROOT, file),
        line,
        rule: 'child-process-exec',
        message: 'shell-oriented child_process exec is forbidden',
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
      const normalized = file.replaceAll('\\', '/');
      if (!normalized.startsWith(resolve(ROOT, 'cubes').replaceAll('\\', '/') + '/') || !normalized.includes('/src/')) continue;
      if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;
    } else if (!file.endsWith('.mjs') && !file.endsWith('.js')) {
      continue;
    }
    reportMatches(file, readFileSync(file, 'utf8'));
  }
}

const approvedPackageDependencies = {
  'safe-path-resolver': {},
  'runtime-capability-inspector': {},
  'bounded-file-content-reader-safe-content-access': { '@sovereign/safe-path-resolver': '0.1.0' },
  'directory-walker-bounded-tree-traversal': { '@sovereign/safe-path-resolver': '0.1.0' },
  'filesystem-metadata-stat-normalizer': { '@sovereign/safe-path-resolver': '0.1.0' },
  'safe-file-quarantine-delete': { '@sovereign/safe-path-resolver': '0.1.0' },
};
for (const [packageName, approvedDependencies] of Object.entries(approvedPackageDependencies)) {
  const packageJsonPath = resolve(ROOT, 'packages', packageName, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (JSON.stringify(pkg.dependencies ?? {}) !== JSON.stringify(approvedDependencies)) {
    violations.push({ file: relative(ROOT, packageJsonPath), line: 1, rule: 'package-dependency-boundary', message: 'runtime dependency declaration is outside approved boundary', source: JSON.stringify(pkg.dependencies ?? {}) });
  }
  for (const field of ['devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (pkg[field] && Object.keys(pkg[field]).length > 0) {
      violations.push({ file: relative(ROOT, packageJsonPath), line: 1, rule: 'package-extra-dependencies', message: `${field} must be absent`, source: JSON.stringify(pkg[field]) });
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
