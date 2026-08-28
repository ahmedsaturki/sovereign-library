from pathlib import Path
import json
import re
import subprocess

ROOT = Path('.')
SAFE_IMPORT = "import { resolveContained } from '../../safe-path-resolver-containment-boundary/src/index.js';"
ALIAS_IMPORT = "import { resolveContained } from '#safe-path-resolver';"
ITEMS = [
    {
        'id': 'bounded-file-content-reader-safe-content-access',
        'name': '@sovereign/bounded-file-content-reader-safe-content-access',
        'description': 'Sovereign bounded-file-content-reader-safe-content-access Cube (standalone).',
        'source': 'cubes/bounded-file-content-reader-safe-content-access/src/index.js',
        'packageDir': 'packages/bounded-file-content-reader-safe-content-access',
    },
    {
        'id': 'directory-walker-bounded-tree-traversal',
        'name': '@sovereign/directory-walker-bounded-tree-traversal',
        'description': 'Sovereign directory-walker-bounded-tree-traversal Cube (standalone).',
        'source': 'cubes/directory-walker-bounded-tree-traversal/src/index.js',
        'packageDir': 'packages/directory-walker-bounded-tree-traversal',
    },
    {
        'id': 'filesystem-metadata-stat-normalizer',
        'name': '@sovereign/filesystem-metadata-stat-normalizer',
        'description': 'Sovereign filesystem-metadata-stat-normalizer Cube (standalone).',
        'source': 'cubes/filesystem-metadata-stat-normalizer/src/index.js',
        'packageDir': 'packages/filesystem-metadata-stat-normalizer',
    },
    {
        'id': 'safe-file-quarantine-delete',
        'name': '@sovereign/safe-file-quarantine-delete',
        'description': 'Sovereign safe-file-quarantine-delete Cube (standalone).',
        'source': 'cubes/safe-file-quarantine-delete/src/index.js',
        'packageDir': 'packages/safe-file-quarantine-delete',
    },
]
EXPECTED = {
    'bounded-file-content-reader-safe-content-access': [
        'FileContentReaderError', 'readFileContent', 'readFileStream', 'readFileChunks',
        'defaultCapabilities', 'BOUNDED_FILE_CONTENT_READER_FORMAT',
    ],
    'directory-walker-bounded-tree-traversal': [
        'DirectoryWalkerError', 'walk', 'defaultCapabilities',
    ],
    'filesystem-metadata-stat-normalizer': [
        'MetadataNormalizerError', 'normalizeEntryMetadata', 'normalizeStat',
        'serializeMetadata', 'parseMetadata', 'getDefaultCapabilities',
    ],
    'safe-file-quarantine-delete': [
        'SafeFileQuarantineError', 'quarantineItem', 'restoreQuarantined',
        'purgeQuarantined', 'defaultCapabilities', 'SAFE_FILE_QUARANTINE_FORMAT',
    ],
}


def run(*args):
    print('+', ' '.join(args))
    subprocess.run(list(args), cwd=ROOT, check=True)


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def ensure_cube_package_scope():
    path = ROOT / 'cubes/package.json'
    if not path.exists():
        path.write_text(json.dumps({
            'private': True,
            'type': 'module',
            'imports': {'#safe-path-resolver': './safe-path-resolver-containment-boundary/src/index.js'},
        }, indent=2) + '\n', encoding='utf-8')


def patch_sources():
    for item in ITEMS:
        path = ROOT / item['source']
        text = path.read_text(encoding='utf-8')
        if ALIAS_IMPORT not in text:
            if SAFE_IMPORT not in text:
                raise RuntimeError(f'missing safe-path import anchor in {path}')
            text = text.replace(SAFE_IMPORT, ALIAS_IMPORT, 1)
            path.write_text(text, encoding='utf-8')


def patch_catalog():
    path = ROOT / 'scripts/package-catalog.json'
    catalog = json.loads(path.read_text(encoding='utf-8'))
    for item in ITEMS:
        catalog[item['id']] = {
            'name': item['name'],
            'version': '0.1.0',
            'description': item['description'],
            'packageDir': item['packageDir'],
            'source': item['source'],
            'expected': EXPECTED[item['id']],
            'dependencies': {'@sovereign/safe-path-resolver': '0.1.0'},
            'imports': {'#safe-path-resolver': '@sovereign/safe-path-resolver'},
            'status': 'TECHNICALLY_READY',
            'reason': 'standalone-capable with explicit @sovereign/safe-path-resolver dependency boundary',
        }
    write_json(path, catalog)


def patch_package_stage():
    path = ROOT / 'scripts/package-stage.mjs'
    text = path.read_text(encoding='utf-8')
    if 'function stageRuntimeDependencies' not in text:
        anchor = 'function main() {\n'
        helper = '''function stageRuntimeDependencies(spec, catalog, packageDir) {
  const dependencies = spec.dependencies || {};
  if (Object.keys(dependencies).length === 0) return;
  const nodeModules = resolve(packageDir, 'node_modules');
  rmSync(nodeModules, { recursive: true, force: true });
  for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
    const dependencySpec = Object.values(catalog).find((candidate) => candidate.name === dependencyName && candidate.version === dependencyVersion);
    if (!dependencySpec) fail(`runtime dependency not found in catalog: ${dependencyName}@${dependencyVersion}`);
    const dependencySource = resolve(ROOT, dependencySpec.source);
    if (!existsSync(dependencySource)) fail(`runtime dependency source is missing: ${dependencySource}`);
    const parts = dependencyName.split('/');
    const dependencyRoot = parts[0].startsWith('@')
      ? resolve(nodeModules, parts[0], parts[1])
      : resolve(nodeModules, dependencyName);
    const dependencySrc = resolve(dependencyRoot, 'src');
    mkdirSync(dependencySrc, { recursive: true });
    const dependencySourceRoot = dirname(dependencySource);
    for (const entry of readdirSync(dependencySourceRoot)) {
      const full = resolve(dependencySourceRoot, entry);
      if (statSync(full).isDirectory()) cpSync(full, resolve(dependencySrc, entry), { recursive: true });
      else if (entry.endsWith('.js') || entry.endsWith('.mjs') || entry.endsWith('.d.ts')) copyFileSync(full, resolve(dependencySrc, entry));
    }
    writeFileSync(resolve(dependencyRoot, 'package.json'), `${JSON.stringify({ name: dependencyName, version: dependencyVersion, type: 'module', exports: { '.': './src/index.js' } }, null, 2)}\n`, 'utf8');
  }
}

'''
        if anchor not in text:
            raise RuntimeError('package-stage main anchor not found')
        text = text.replace(anchor, helper + anchor, 1)
    marker = '  const expected = new Set(spec.expected || []);\n'
    call = '  stageRuntimeDependencies(spec, catalog, packageDir);\n'
    if call not in text:
        if marker not in text:
            raise RuntimeError('package-stage expected export anchor not found')
        text = text.replace(marker, marker + call, 1)
    path.write_text(text, encoding='utf-8')


def patch_package_verifier():
    path = ROOT / 'scripts/verify-package-tooling.mjs'
    text = path.read_text(encoding='utf-8')
    text = re.sub(
        r"const CANDIDATES = \[[\s\S]*?\n\];",
        "const CATALOG = JSON.parse(readFileSync(resolve(ROOT, 'scripts/package-catalog.json'), 'utf8'));\nconst CANDIDATE_IDS = ['safe-path-resolver', 'runtime-capability-inspector', 'bounded-file-content-reader-safe-content-access', 'directory-walker-bounded-tree-traversal', 'filesystem-metadata-stat-normalizer', 'safe-file-quarantine-delete'];\nconst CANDIDATES = CANDIDATE_IDS.map((id) => ({ id, packageDir: resolve(CATALOG[id].packageDir), script: resolve('scripts/package-stage.mjs'), dependencies: CATALOG[id].dependencies ?? {}, imports: CATALOG[id].imports ?? {} }));",
        text,
        count=1,
    )
    old = "  if (pkg.dependencies || pkg.peerDependencies || pkg.optionalDependencies) fail(`${candidate.id} must have no runtime dependency declarations`);"
    new = "  if (JSON.stringify(pkg.dependencies ?? {}) !== JSON.stringify(candidate.dependencies)) fail(`${candidate.id} runtime dependency boundary mismatch`);\n  if (JSON.stringify(pkg.imports ?? {}) !== JSON.stringify(candidate.imports)) fail(`${candidate.id} imports boundary mismatch`);\n  if (pkg.devDependencies || pkg.peerDependencies || pkg.optionalDependencies) fail(`${candidate.id} must not declare dev/peer/optional dependencies`);"
    if old not in text:
        raise RuntimeError('package verifier dependency anchor not found')
    text = text.replace(old, new, 1)
    marker = "    const tarball = resolve(packDir, packResult[0].filename);\n"
    probe = "    run(process.execPath, ['--input-type=module', '-e', \"await import('./src/index.js')\"], candidate.packageDir);\n"
    if probe not in text:
        if marker not in text:
            raise RuntimeError('package verifier tarball anchor not found')
        text = text.replace(marker, probe + marker, 1)
    cleanup = "    rmSync(resolve(candidate.packageDir, 'NOTICE'), { force: true });\n"
    if "rmSync(resolve(candidate.packageDir, 'node_modules')," not in text:
        text = text.replace(cleanup, cleanup + "    rmSync(resolve(candidate.packageDir, 'node_modules'), { recursive: true, force: true });\n", 1)
    path.write_text(text, encoding='utf-8')


def patch_repro():
    path = ROOT / 'scripts/verify-reproducible-package.mjs'
    text = path.read_text(encoding='utf-8')
    text = re.sub(
        r"const CANDIDATES = \[[\s\S]*?\n\];",
        "const CANDIDATES = [\n  { id: 'safe-path-resolver', packageDir: resolve('packages/safe-path-resolver') },\n  { id: 'runtime-capability-inspector', packageDir: resolve('packages/runtime-capability-inspector') },\n  { id: 'bounded-file-content-reader-safe-content-access', packageDir: resolve('packages/bounded-file-content-reader-safe-content-access') },\n  { id: 'directory-walker-bounded-tree-traversal', packageDir: resolve('packages/directory-walker-bounded-tree-traversal') },\n  { id: 'filesystem-metadata-stat-normalizer', packageDir: resolve('packages/filesystem-metadata-stat-normalizer') },\n  { id: 'safe-file-quarantine-delete', packageDir: resolve('packages/safe-file-quarantine-delete') },\n];",
        text,
        count=1,
    )
    cleanup = "    rmSync(resolve(candidate.packageDir, 'NOTICE'), { force: true });\n"
    if "rmSync(resolve(candidate.packageDir, 'node_modules')," not in text:
        text = text.replace(cleanup, cleanup + "    rmSync(resolve(candidate.packageDir, 'node_modules'), { recursive: true, force: true });\n", 1)
    path.write_text(text, encoding='utf-8')


def patch_security():
    path = ROOT / 'scripts/verify-security-boundaries.mjs'
    text = path.read_text(encoding='utf-8')
    old = '''for (const packageName of ['safe-path-resolver', 'runtime-capability-inspector']) {
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
}'''
    new = '''const approvedPackageDependencies = {
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
}'''
    if old not in text:
        raise RuntimeError('security package dependency anchor not found')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def patch_docs():
    matrix_path = ROOT / 'docs/release/PACKAGE_QUALIFICATION_MATRIX-V0.1.md'
    matrix = matrix_path.read_text(encoding='utf-8')
    matrix = matrix.replace('# Package Qualification Matrix (v15)', '# Package Qualification Matrix (v16)', 1)
    matrix = matrix.replace('| TECHNICALLY_READY | 73 |', '| TECHNICALLY_READY | 77 |', 1)
    matrix = matrix.replace('| CONDITIONAL | 4 |', '| CONDITIONAL | 0 |', 1)
    for item in ITEMS:
        pattern = re.compile(r'^\| ' + re.escape(item['id']) + r' \|.*$', re.MULTILINE)
        replacement = f"| {item['id']} | TECHNICALLY_READY | {item['name']} | explicit @sovereign/safe-path-resolver runtime dependency boundary; standalone staging and isolated runtime qualification |"
        matrix, count = pattern.subn(replacement, matrix, count=1)
        if count != 1:
            raise RuntimeError(f'matrix row not found for {item["id"]}')
    matrix_path.write_text(matrix, encoding='utf-8')

    control_path = ROOT / 'PROJECT_CONTROL.md'
    control = control_path.read_text(encoding='utf-8')
    control = control.replace('74 package entries representing 73 unique Cube sources', '78 package entries representing 77 unique Cube sources', 1)
    control = control.replace('- Cubes with unresolved runtime coupling kept CONDITIONAL until the dependency boundary can be made real without breaking monorepo behavior;', '- The four previously Conditional safe-path-resolver consumers now use explicit @sovereign/safe-path-resolver dependency boundaries and qualify as TECHNICALLY_READY;', 1)
    control_path.write_text(control, encoding='utf-8')


def validate_manifests():
    for item in ITEMS:
        path = ROOT / item['packageDir'] / 'package.json'
        if not path.exists():
            raise RuntimeError(f'missing package manifest: {path}')
        pkg = json.loads(path.read_text(encoding='utf-8'))
        expected = {
            'name': item['name'], 'version': '0.1.0', 'type': 'module',
            'license': 'Apache-2.0', 'engines': {'node': '>=24'},
            'sideEffects': False,
            'dependencies': {'@sovereign/safe-path-resolver': '0.1.0'},
            'imports': {'#safe-path-resolver': '@sovereign/safe-path-resolver'},
        }
        for key, value in expected.items():
            if pkg.get(key) != value:
                raise RuntimeError(f'{item["id"]} manifest mismatch at {key}: {pkg.get(key)!r}')


def main():
    ensure_cube_package_scope()
    patch_sources()
    patch_catalog()
    patch_package_stage()
    patch_package_verifier()
    patch_repro()
    patch_security()
    patch_docs()
    validate_manifests()

    changed_sources = [item['source'] for item in ITEMS]
    run('node', '--check', *changed_sources)
    run('node', '--check', 'scripts/package-stage.mjs')
    run('node', '--check', 'scripts/verify-package-tooling.mjs')
    run('node', '--check', 'scripts/verify-reproducible-package.mjs')
    run('node', '--check', 'scripts/verify-security-boundaries.mjs')
    run('node', '--test', '--test-timeout=10000', *[f"{item['source'].split('/src/')[0]}/test/index.test.js" for item in ITEMS])
    run('node', 'scripts/verify-package-tooling.mjs')
    run('node', 'scripts/verify-reproducible-package.mjs')
    run('node', 'scripts/verify-security-boundaries.mjs')
    print('SAFE-PATH BOUNDARY QUALIFICATION PASSED')


if __name__ == '__main__':
    main()
