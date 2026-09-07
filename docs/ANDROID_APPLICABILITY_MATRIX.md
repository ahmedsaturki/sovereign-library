# Android Applicability Matrix — Sovereign Library

> Authoritative source: GitHub. This matrix is the evidence basis for selecting the
> first native Android Cube. It is additive; it does not modify completed work.

## Method

Each candidate Cube was evaluated against:

- Android value (does it solve a real Android problem?)
- mobile / offline / security relevance
- filesystem + runtime/environment applicability on Android
- native API availability (and whether the contract *needs* Android APIs at all)
- expected performance + memory + dependency footprint
- maintenance cost, conformance feasibility, distribution feasibility

Android is **not** the desktop JVM. The assessment explicitly accounts for the
Android sandbox, scoped storage, runtime permissions, process/model constraints,
ART vs. HotSpot differences, and the absence of desktop filesystem assumptions.

Classification: **HIGH / MEDIUM / LOW / NOT_APPLICABLE**.

## Candidates

### safe-path-resolver (SPR1)
- **Android value: HIGH.** Path containment is a first-class mobile security concern
  (deep-link/URI handling, exported component path injection, file-provider scoping).
- **Mobile/offline/security: HIGH.** Pure-lexical, no network, deterministic.
- **Filesystem applicability: MEDIUM.** The contract is *lexical only* (no I/O), so it
  works identically on Android; real filesystem access would use the Storage Access
  Framework, but the Cube stays lexical by contract.
- **Native API availability: N/A — none required.** This is the key insight: SPR1 uses
  zero platform APIs, so it needs no Android-specific mapping and ports with no semantic drift.
- **Performance/memory: HIGH.** Tiny, allocation-light, no reflection in the hot path.
- **Dependency footprint: ZERO** runtime deps.
- **Conformance feasibility: HIGH.** Reuses the exact Kotlin/JVM algorithm + the same
  language-neutral vectors.
- **Distribution: HIGH.** Builds as an AAR; Maven-compatible (GitHub-first).
- **Classified: HIGH** → selected as the first Android Cube.

### runtime-capability-inspector (RCI1)
- **Android value: MEDIUM-HIGH.** Android runtime capability gating is useful
  (min SDK, ABI/architecture, memory class, CPU).
- **Native API availability: PARTIAL.** `arch`/`cpuCount`/`memoryBytes` exist on Android
  (`Build.SUPPORTED_ABIS`, `Runtime.getRuntime()`, `ActivityManager.MemoryInfo`), but
  several fields the contract models (Node `nodeVersion`, desktop OS family) are
  **not meaningful on Android** — mapping them is artificial.
- **Conformance feasibility: MEDIUM.** The canonical vectors assume a desktop OS family
  namespace; Android would need a *distinct, contract-compatible* snapshot shape, which
  is a larger, riskier first port.
- **Classified: MEDIUM** → deferred after SPR1 (strong second candidate, but needs a
  deliberate Android snapshot mapping, not a 1:1 copy).

### canonical-json (CJSON1)
- **Android value: MEDIUM.** Useful as a deterministic serialization primitive inside
  other Android Cubes.
- **Native API availability: N/A** (pure algorithm).
- **Classified: MEDIUM** → candidate, but lower independent user-facing value than SPR1.

### digest (DIG1)
- **Android value: MEDIUM.** `MessageDigest` (SHA-256 etc.) is fully available via
  `java.security` on Android; no mapping needed.
- **Classified: MEDIUM** → good later candidate, but not the first (less security-critical
  alone than path containment).

### validation / result / url / cache
- **Android value: LOW-MEDIUM.** All are pure-logic, portable, and useful as internal
  building blocks, but none carries the standalone security weight of SPR1 on mobile.
- **Classified: LOW-MEDIUM** → deferred.

### Browser/integration Cubes
- **NOT_APPLICABLE** to native Android Kotlin (they are Chromium/CDP-bound and already
  PRE_RELEASE on the web platform).

## Decision

**First native Android Cube: `safe-path-resolver` (SPR1).**

Rationale (evidence-based):
1. Highest standalone Android *security* value (path containment / traversal defense).
2. Zero platform-API dependency → no semantic drift, no artificial mapping, faithful
   conformance to the existing canonical vectors.
3. Smallest, lowest-risk proof-of-architecture for the new `ecosystems/android` layer.
4. Reuses the verified Kotlin/JVM algorithm and the shared conformance infrastructure.

RCI1 is the strong **second** candidate but is deferred until a deliberate,
contract-compatible Android snapshot mapping is designed (it cannot be a 1:1 copy
because Node/desktop OS concepts are meaningless on Android).

## Honest limitation (recorded, not hidden)

The Android SDK + emulator are **not installed** in this environment. Therefore:
- The Android library is implemented as genuine Kotlin/Android (`com.android.library`,
  AAR target, `minSdk`/`compileSdk` set), and its unit + conformance tests run on the
  JVM-hosted Android test runner (real execution, not source review).
- **On-device / emulator instrumented tests are not executed here** because no SDK/emulator
  is available. This is classified as an **ANDROID_ENVIRONMENT** gap, not a code defect.
- The AAR artifact build and out-of-tree consumption are performed once the SDK is
  installed (installation in progress). Until then, the Cube is **IN_PROGRESS**, not
  TECHNICALLY_READY. No "Android supported" claim is made on the basis of JVM-only evidence.

This matches the project's no-fake-multi-platform rule: Android readiness requires an
actual Android artifact + build/test + conformance + CI/device evidence.
