# PR #125 — Current Continuation Checkpoint

Always read the live branch ref first:

`refs/heads/feat/continuity-hardening`

That live ref is the only authoritative current HEAD. Historical SHA references in reports, comments, or older control records must not be used as current evidence.

## State

- Branch: `feat/continuity-hardening`
- PR: `#125`
- Base: `main`
- PR state: OPEN / UNMERGED
- Current HEAD: `d51aedd8fc8251887d6e5ed7abb255ff4c1706f6`
- GitHub Releases: EXISTING releases are present in the repository; these must be distinguished from publication to external package registries.
- External package-registry publication (npm/PyPI/Maven/etc.): NO VERIFIED CURRENT EVIDENCE OF PUBLICATION BY THIS CONTINUATION

## Live exact-head CI qualification — 2026-09-16

Fresh workflows for exact HEAD `d51aedd8fc8251887d6e5ed7abb255ff4c1706f6` are terminal-successful across all six required workflows:

- `verify` #1213 — SUCCESS
- `python-ports` #169 — SUCCESS
- `kotlin-jvm` #159 — SUCCESS
- `phase3` #87 — SUCCESS
- `release-engineering` #80 — SUCCESS
- `android` #217 — SUCCESS

Android #217 reached success after a job-only rerun. Attempt 1 failed only in the Ubuntu Android instrumentation path during `installDebugAndroidTest` after the emulator ran without KVM and ddmlib reported `ShellCommandUnresponsiveException` / `Unknown API Level`. The rerun used the same source revision with no code changes and completed the mandatory Ubuntu instrumentation gate successfully.

The successful Android run uploaded artifact `android-aars` (artifact id `10466543207`, sha256 `86e663c3642e416ea7bf06abc985f0b76ff014a38cec233344ba238797d30385`).

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

The repository currently contains published GitHub Release objects, including the first-batch releases for `safe-path-resolver` and `runtime-capability-inspector`, plus existing releases for other qualified Cubes. These are repository/GitHub distribution events and are distinct from publication to external package registries such as npm, PyPI, or Maven.

Verified first-batch GitHub Releases include:

- `v0.1.0-safe-path-resolver` with asset `sovereign-safe-path-resolver-0.1.0.tgz`.
- `v0.1.0-runtime-capability-inspector` with asset `sovereign-runtime-capability-inspector-0.1.0.tgz`.

The current continuation must therefore use these separate facts:

1. GitHub Releases EXIST and are directly observable in the repository release history.
2. No verified current continuation evidence establishes publication to npm, PyPI, or Maven Central.
3. A new release/tag/publication must not be created merely because a Cube is technically ready; explicit release controls still apply.

## Required continuation

1. Preserve the exact live HEAD and current terminal CI evidence.
2. Keep control-plane and status documents aligned with the live ref; embedded historical SHAs remain historical evidence only.
3. Determine exactly one next authorized Cube/task from the authoritative roadmap/control records.
4. Continue through `SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE PREP -> FREEZE -> NEXT CUBE` without redoing completed qualification waves.

## Governance

- Do not merge PR #125 automatically.
- Do not create a new release or publish to an external registry without explicit release authorization.
- Do not weaken or remove emulator requirements.
- Do not bypass 2FA/publication guards.
- Do not rewrite or destroy historical evidence.
- Do not treat queued, cancelled, or partial CI as qualification evidence.
