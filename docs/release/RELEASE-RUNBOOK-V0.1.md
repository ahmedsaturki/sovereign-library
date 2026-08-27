# Sovereign Library — Release Runbook v0.1 (Phase-0 First Batch)

> PREPARATION ARTIFACT. No publication is performed by this document.
> Executed only AFTER explicit human release authorization.

## Candidates (frozen contract)
- `@sovereign/safe-path-resolver` v0.1.0  → source: `cubes/safe-path-resolver-containment-boundary/src/index.js`
- `@sovereign/runtime-capability-inspector` v0.1.0 → source: `cubes/runtime-capability-inspector/src/index.js`

Package manifests already exist at `packages/<name>/package.json` and are verified
against `docs/PACKAGE_CONTRACT_V0.1.md`. `packages/<name>/src` and `dist` are
generated at pack time by `scripts/package-stage.mjs` (do NOT pre-create them).

## Sequence

```
AUTHORIZED
  → FINAL VERIFY
  → PACKAGE (stage + npm pack)
  → TAG / RELEASE (git tag + GitHub Release)
  → PUBLISH (npm publish, only after tag+release)
  → POST-PUBLISH VERIFY (install out-of-tree, run API, provenance)
  → FREEZE (mark candidates RELEASED in PROJECT_CONTROL)
  → UPDATE CONTROL PLANE (advance Phase-0 gate)
```

### 0. AUTHORIZED
Precondition: human has recorded explicit release-authorization decision.
Guard: `scripts/verify-publication-guard.mjs` must still pass (no publish command,
no registry credential, no publishConfig, root private). If it fails, STOP.

### 1. FINAL VERIFY
Commands (from repo root):
```
npm run check                                  # exit 0
npm test                                       # 757/757 (note: known infra flake in process-supervisor under full load; bounded runner is authoritative)
node scripts/run-tests-bounded.mjs             # ALL PASS
node scripts/verify-publication-guard.mjs      # ALL PUBLICATION GUARD CHECKS PASSED
node scripts/verify-security-boundaries.mjs    # ALL SECURITY BOUNDARY CHECKS PASSED
node scripts/verify-browser-assertions-tarball.mjs  # ALL PACKAGE-INDEPENDENCE CHECKS PASSED
```
Safety: any non-zero exit = STOP, do not proceed.

Package-specific staging + declaration verification:
```
node scripts/verify-package-tooling.mjs        # stages both, asserts exact export surface
node scripts/verify-declarations.mjs           # declaration pilot
node scripts/verify-reproducible-package.mjs   # two clean packs byte-identical
```
(Note: local nvm4w node lacks co-located bundled npm; CI uses actions/setup-node
bundled npm. Run these in CI or with a bundled-npm node.)

### 2. PACKAGE
For each candidate:
```
node scripts/package-stage.mjs safe-path-resolver
node scripts/package-stage.mjs runtime-capability-inspector
cd packages/safe-path-resolver && npm pack --ignore-scripts --pack-destination <staging>
cd packages/runtime-capability-inspector && npm pack --ignore-scripts --pack-destination <staging>
```
Expected artifacts:
- `sovereign-safe-path-resolver-0.1.0.tgz`  (6 files: LICENSE, NOTICE, README.md, package.json, src/index.js, dist/index.d.ts)
- `sovereign-runtime-capability-inspector-0.1.0.tgz` (same shape)
Rollback point: tarballs are staging-only; nothing published yet.

### 3. TAG / RELEASE
```
git tag -s v0.1.0-safe-path-resolver <sha>
git tag -s v0.1.0-runtime-capability-inspector <sha>
git push origin --tags
# GitHub Release per package referencing the tarball + provenance
```
Safety: tags are the rollback point. No publish until tags exist.

### 4. PUBLISH
```
npm publish <staging>/sovereign-safe-path-resolver-0.1.0.tgz --provenance --access public
npm publish <staging>/sovereign-runtime-capability-inspector-0.1.0.tgz --provenance --access public
```
Preconditions: npm org created + token configured (OUT OF SCOPE until authorized),
publication guard still green. Each publish is independent; failure of one does not
force the other.

### 5. POST-PUBLISH VERIFY
```
npm install @sovereign/safe-path-resolver@0.1.0 (out-of-tree, temp dir)
node -e "import('@sovereign/safe-path-resolver').then(m=>console.log(Object.keys(m).sort()))"
# expect: [SAFE_PATH_RESOLVER_FORMAT, SAFE_PATH_RESOLVER_LIMITS, SafePathResolverError,
#          canonicalizePath, comparePaths, isContained, normalizePath, parseReport,
#          resolveContained, resolvePath, serializeReport]
# repeat for runtime-capability-inspector
```
Expected: install succeeds, exact export surface, no monorepo path dependency.

### 6. FREEZE
Update `PROJECT_CONTROL.md`: mark both candidates RELEASED; record the published
versions, publish SHAs, and npm provenance URLs.

### 7. UPDATE CONTROL PLANE
Advance the Phase-0 gate to the next batch (remaining 6 of 8 contracted candidates)
or close Phase 0. Record in `ROADMAP.md`.

## Verification gates summary
| Gate | Expected | Blocker if fail |
|------|----------|----------------|
| publication guard | PASS | YES (governance) |
| final verify | all green | YES |
| package tooling | exact export surface | YES |
| reproducible pack | byte-identical | YES |
| post-publish install | exact API, no monorepo leak | YES |

## Artifacts produced
- two `.tgz` tarballs (staging)
- two signed git tags
- two GitHub Releases
- two npm publications (provenance)

## SHA references (preparation baseline)
- Source HEAD at preparation: `c4272f0f71d8e5d33bbd764feb9d63d787cf3f3b`
- CI at preparation: Run #862 `completed success` (Ubuntu / Windows / macOS-15-Intel)
- Phase-0 historical baseline: `f14bbd9229fcda23f00602cfc9288881c61e213e` / Runs #835 #837 #845
