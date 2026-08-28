# Sovereign Library — Agent Operating Manual

> This file is the **agent entry point and permanent memory home** for Sovereign Library.
> A future agent must be able to recover the entire operating model from this repository
> alone. If any answer below requires chat history, that is a defect — fix the repository,
> do not proceed on memory.
>
> Authority order (when facts conflict): actual GitHub state > current source > current
> tests > current CI > current package artifacts > control-plane records > historical
> records > chat. Chat history is the weakest source and is NEVER the system of record.

## 1. What Sovereign is

Sovereign Library is a collection of **standalone, dependency-free software "cubes"**
(independent modules) and the real products that compose them. Each cube is independently
usable, testable, packageable, distributable, replaceable, secure, deterministic within
contract, cross-platform where applicable, versioned, and documented.

Philosophy: surpass competitors (Playwright / Selenium / Cypress / Puppeteer and beyond) by
absorbing their ideas while avoiding their flaws — pure/original, **zero runtime third-party
dependencies** per cube. Standard libraries and native OS primitives are allowed foundations.

## 2. Permanent principles (summary)

The full, binding law lives in `GOVERNANCE.md` and the Architecture Constitution
(`contracts/`). The non-negotiable defaults:

- **Additive evolution is the default.** Prefer ADD → EXTEND → IMPROVE → SUPERSEDE →
  DEPRECATE → ARCHIVE → DEFER over DELETE → REPLACE → ERASE. Never make the project look as
  if something never existed.
- **No silent replacement.** Supersede with OLD → WHY → NEW → COMPATIBILITY → MIGRATION →
  STATUS. Mark DEFERRED / NOT_APPLICABLE / EXPERIMENTAL / PARKED; never delete to "clean up".
- **Repository-first execution.** Read the permanent memory, do the work, update the
  control plane, commit, push, and verify the remote before stopping.
- **One authoritative home per truth** (see §6).
- **History must remain visible.** Never rewrite history to look cleaner. Record
  FAILURE → ROOT CAUSE → FIX → VERIFICATION → CURRENT STATE.
- **Build — do not destroy. Extend — do not silently replace. Record — do not forget.
  Verify — do not assume. Persist — do not leave local-only state. Push — do not depend on
  chat.**

## 3. Architectural law (permanent)

`INDEPENDENT CUBES → EXPLICIT COMPOSITION → REAL PRODUCTS`

Every suitable cube is independently usable, testable, packageable, distributable,
explicitly dependency-bound, replaceable, secure, deterministic within contract,
cross-platform where applicable, versioned, and documented. Products compose cubes; products
must not destroy cube independence.

## 4. Multi-ecosystem law

`ONE AUTHORITATIVE CONTRACT → NATIVE IMPLEMENTATION PER ECOSYSTEM → CONFORMANCE →
INDEPENDENT DISTRIBUTION`

- **JavaScript-first** is the current authoritative implementation ecosystem.
- Target ecosystems: Node.js, Python, Kotlin, Android, iOS where justified.
- Do NOT claim an implementation exists where it does not.
- Do NOT mechanically transpile Node.js into Python/Kotlin.
- Do NOT make one ecosystem secretly depend on another.

## 5. Distribution policy (CURRENT)

**GitHub-only.** No external registry publication at this stage. Do NOT publish to npm,
PyPI, Maven Central, or other external registries unless this policy is explicitly changed
in the repository. Independent library packaging remains mandatory; distribution through
GitHub means source, tags, GitHub Releases, release assets, checksums, documentation, and
reproducible artifacts.

## 6. One authoritative home per truth

| Truth | Authority |
|-------|-----------|
| Current state / what changed / next task | `PROJECT_CONTROL.md` |
| Architecture law | Architecture Constitution (`contracts/`) |
| Knowledge map | Project Knowledge Base (`docs/`) |
| Long-term plan | `ROADMAP.md` |
| Behavior / cube contract | `contracts/CUBE_CONTRACT_V1.md`, SPEC files (`specs/`) |
| Implementation | source (`cubes/`) |
| Test proof | tests + CI |
| Package contract | `docs/PACKAGE_CONTRACT_V0.1.md`, package metadata |
| Release | release records (`docs/PUBLIC_PACKAGE_RELEASE_*.md`) |
| Governance / DO-NOT list | `GOVERNANCE.md` |
| Agent entry | this file (`AGENTS.md`) |
| Machine-readable rules | Ecosystem Contract JSON (`contracts/`) |

Other documents link to the authority instead of inventing competing truths.

## 7. CUBE lifecycle

`IDEA → SPEC → IMPLEMENT → TEST → FIX → VERIFY → TECHNICALLY_READY →
RELEASE_CANDIDATE → AUTHORIZED → RELEASED → FROZEN`

Do not skip states. Do not call something RELEASED without distribution evidence; do not call
it FROZEN without a recorded freeze.

## 8. GOVERNANCE — DO-NOT LIST (hard constraints)

These are standing decisions recorded in `GOVERNANCE.md`. They are NOT suggestions.

1. **Never merge PR #111** (`feat/browser-interactions-assertions-webtestkit`). It adds
   browser-interactions + browser-assertions cubes and a web-test-kit product — that work is
   a separate wave (browser/product policy, rule #19) and is intentionally parked. Awaiting
   explicit reclassification, it must not enter `main`.
2. **Never publish to any external registry** (npm / PyPI / Maven Central / etc.) under the
   current GitHub-only distribution policy.
3. **Never push directly to `main`** for substantive change without an explicit, reviewed PR.
   (`main` is also the subject of hardening issue #109; treat it as protected by discipline
   even before CI-required-checks are enforced.)
4. **Never force-push** to any shared branch.
5. **Never rewrite history** (no `git rebase --root`, no `filter-branch`, no `amend` of
   pushed history).
6. **Never modify frozen/released code** — runtime OR tests — without separate explicit
   authorization. Released/frozen SHAs are immutable evidence.
7. **Never delete released/frozen cubes, packages, docs, tests, APIs, contracts, or roadmap
   items** to "clean up." Archive / deprecate / mark-obsolete instead.
8. **Never treat CI success as publication authorization.** Authorization is a separate
   human governance decision (issue #110).

## 9. Current official task (recoverable from PROJECT_CONTROL.md)

- **Milestone:** `PHASE-0-RELEASE-AUTHORIZATION-READY`
- **Immediate next task (HUMAN decision):** obtain the explicit release-authorization
  decision for the two verified candidates — `@sovereign/safe-path-resolver` v0.1.0 and
  `@sovereign/runtime-capability-inspector` v0.1.0 (issue #110). Until that decision exists,
  do NOT publish, create/reserve an npm org, configure npm tokens, add registry automation,
  or announce a public release.
- The candidate packages are already staged under `packages/` and verified by CI
  (Run #845 / #849) but are **NOT authorized for publication**.

## 10. Recovery order (on interruption)

1. This file (`AGENTS.md`)
2. `PROJECT_CONTROL.md`
3. `ROADMAP.md`
4. Actual GitHub state (`gh` / `git`)
5. Latest commit + latest CI run
6. Relevant SPEC (`specs/`)
7. Active task (as recorded in `PROJECT_CONTROL.md`)

Resume from the listed immediate next task. Do NOT restart from memory.

## 11. Execution loop (for every real task)

UNDERSTAND → INSPECT → SPECIFY → IMPLEMENT → TEST → FIX → VERIFY → DOCUMENT → PERSIST →
COMMIT → PUSH → CI → RECONCILE → UPDATE CONTROL PLANE → NEXT.

Every checkpoint: update source-of-truth docs, run relevant verification, commit, push,
verify remote branch + PR HEAD, record CI when appropriate. Do not leave important work
local-only.

## 12. Startup self-test (must pass from repo alone)

A future agent must answer from the repo alone: what Sovereign is; its permanent principles;
current architecture; current task; completed/frozen/pre-release/deferred/blocked work;
packages; platforms; distribution policy; next task; what must NOT be changed. If any answer
needs chat history, fix the repository memory first.
