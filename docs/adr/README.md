# Architecture Decision Records (ADR)

**Status:** Phase-3 / Continuity-Hardening Wave

This directory holds the ADR system. ADRs capture *why* an
architecturally significant decision was made — not *what* was built,
which lives in code, and not *how*, which lives in commits.

ADRs are immutable once accepted. A new decision supersedes an old
one by adding a new ADR and explicitly marking the old one
`Superseded by ADR-NNNN`.

## Lifecycle

1. **Proposed** — drafted, not yet decided.
2. **Accepted** — chosen; status updated to `Accepted`.
3. **Superseded** — replaced by a later ADR.
4. **Deprecated** — no longer applicable, but kept for context.

## Index

| ADR     | Title                                                  | Status     | Date       |
|---------|--------------------------------------------------------|-----------|------------|
| 0001    | Why dependency-free cubes?                             | Accepted  | 2024-01-04 |
| 0002    | Why TypeScript-typed JSDoc instead of TS source?       | Accepted  | 2024-02-19 |
| 0003    | Why stdlib-only test harness instead of jest/vitest?   | Accepted  | 2024-03-22 |
| 0004    | Why MD/MD-spec-driven cube contracts?                  | Accepted  | 2024-05-11 |
| 0005    | Why Phase-3 introduces formal verification             | Accepted  | 2026-09-07 |
| 0006    | Why TLS 1.3-only and post-quantum readiness now        | Accepted  | 2026-09-07 |
| 0007    | Why Zero Trust by default for all new HTTP surfaces    | Accepted  | 2026-09-07 |
| 0008    | Why ADR/RFC process introduced in Phase-3              | Accepted  | 2026-09-07 |
| 0009    | Why STRIDE + PASTA threat modelling is mandatory       | Accepted  | 2026-09-07 |
| 0010    | Why GDPR automation is opt-in per data class           | Accepted  | 2026-09-07 |

## Conventions

- ADR file name: `NNNN-title-with-hyphens.md`.
- Header: `Status:`, `Date:`, `Deciders:`, `Consulted:`, `Informed:`.
- A short prose **Context**, **Decision**, **Consequences** section.
- **Alternatives Considered** with explicit rejection reasoning.
- See `template.md` for the skeleton.