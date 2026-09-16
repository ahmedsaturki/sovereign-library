# PR #125 — Current Continuation Checkpoint

Always read the live branch ref first:

`refs/heads/feat/continuity-hardening`

That live ref is the only authoritative current HEAD. Historical SHA references in reports, comments, or older control records must not be used as current evidence.

## State

- Branch: `feat/continuity-hardening`
- PR: `#125`
- Base: `main`
- PR state: OPEN / UNMERGED
- Current verified HEAD: `fe72485340b4a64b5b32fc39faf032db3a2ae349`
- GitHub Releases: EXISTING releases are present in the repository; these are distinct from publication to external package registries.
- External package-registry publication (npm/PyPI/Maven/etc.): NO VERIFIED CURRENT EVIDENCE OF PUBLICATION BY THIS CONTINUATION

## Live exact-head CI qualification — 2026-09-17

Fresh workflows for exact HEAD `fe72485340b4a64b5b32fc39faf032db3a2ae349` are terminal-successful across all six required workflows:

- `verify` #1219 — SUCCESS
- `python-ports` #172 — SUCCESS
- `kotlin-jvm` #162 — SUCCESS
- `phase3` #93 — SUCCESS
- `release-engineering` #86 — SUCCESS
- `android` #221 — SUCCESS

All six runs checked out the exact `fe72485340b4a64b5b32fc39faf032db3a2ae349` revision where applicable and completed successfully.

## Android hardening qualification

Android #221 completed successfully on all three matrix platforms:

- Windows instrumentation — SUCCESS
- macOS-15-Intel instrumentation — SUCCESS
- mandatory Ubuntu Android instrumentation gate — SUCCESS

The Ubuntu job also completed the AAR upload successfully.

Artifact evidence:

- Artifact: `android-aars`
- Artifact ID: `10472677320`
- Size: `24463` bytes
- Upload ZIP digest: `sha256:00c1259e5ac3379cbcff376f7e1facbf2e69372b38611d141747cf9e63f319b0`

The prior Windows Android failure was:

`com.android.ddmlib.InstallException: Unknown failure: cmd: Can't find service: package`

The hardening added bounded Android Package Manager readiness probing plus a bounded instrumentation-install command. On the fresh run, Windows `installDebugAndroidTest` completed successfully (`Installed on 1 device.`), followed by successful instrumentation tests. This is a verified infrastructure hardening result, not a test bypass.

Ubuntu also demonstrated successful package-service readiness, bounded APK installation, and execution of the required Android device tests.

## Completed implementation / qualification layers

- Browser/Product Readiness Wave completed; do not redo unless a genuine regression appears.
- Existing qualified Python ports preserved.
- `sovereign_validation` correctly uses `python/sovereign_validation/src/sovereign_validation/__init__.py`.
- Native `sovereign_url`, `sovereign_circuit_breaker`, and `sovereign_retry` implementations remain present with tests, metadata, README, and CI wiring as applicable.
- Retry timeout validation uses Python `ValueError` rather than the historical undefined `RangeError` contract.
- Retry uses FakeClock-driven timeout and backoff timing for deterministic tests.
- Python CI installs `pytest pytest-asyncio`.
- Browser Chromium/CDP smoke remains fail-closed.
- Android instrumentation remains a real qualification gate and is verified on the current exact HEAD.
- Chaos `signal-storm` probe portability/hardening remains preserved and passed the current release-engineering gate.

## Qualification matrix

The authoritative packaging matrix remains v17: 84 Cubes are recorded as `TECHNICALLY_READY`, with 0 `PRE_RELEASE` and 0 `CONDITIONAL`; the two Products are recorded separately as technically ready in the package catalog.

Readiness claims remain tied to the applicable Cube and exact evidence; CI success does not retroactively rewrite historical qualification records.

## Resolved historical `130 references` discrepancy

The previously reported `130 references` count has been reconciled against the repository control plane and historical records. No reproducible repository calculation or artifact substantiates that number. It is retained only as historical checkpoint context and is not a current Cube/package/reference count and must not be used as authorization input.

## Distribution / release-state reconciliation

The repository currently contains GitHub Release objects, including first-batch releases for `safe-path-resolver` and `runtime-capability-inspector`, plus other historical releases. These GitHub release events are distinct from publication to external package registries such as npm, PyPI, or Maven.

Issue #110 explicitly records these two first-batch packages as authorized in principle while publication remains deferred by the project owner's current policy. No external registry publication is performed by this continuation merely because CI is green.

## Current governance gate

- PR #125 remains OPEN / UNMERGED.
- No currently open authoritative record provides a new explicit Cube/task authorization beyond the existing first-batch release authorization in issue #110.
- Issue #109 remains a parked hardening task and is not the active milestone.
- PR #111 remains open/unmerged and its existing scope does not establish a new authorization for a separate current milestone.
- No external publication is authorized by this checkpoint.

## Required continuation

1. Preserve the exact live HEAD and terminal CI evidence.
2. Keep control-plane and status documents aligned with the live ref; embedded historical SHAs remain historical evidence only.
3. Select exactly one next authorized Cube/task from the authoritative roadmap/control records when authorization exists.
4. Continue through `SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE PREP -> FREEZE -> NEXT CUBE` without redoing completed qualification waves.
5. Do not merge PR #125 automatically.

## Governance locks

- No merge or auto-merge of PR #125.
- No new release/tag merely because CI is green.
- No external registry publication without explicit release-wave authorization.
- No credential or 2FA guard bypass.
- No weakening or removal of Android/emulator requirements.
- No force-push or history rewrite.
- Do not treat queued, cancelled, partial, or historical CI as current qualification evidence.
