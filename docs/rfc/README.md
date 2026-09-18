# Request for Comments (RFC) Process

**Status:** Phase-3 / Continuity-Hardening Wave

RFCs capture *proposals for changes* that are large or
cross-cutting enough to need cross-team review before merging.
Unlike ADRs (which record the **why** of a **decision**), RFCs
describe a **future** change in enough detail that an
unfamiliar reviewer can evaluate it.

## Lifecycle

1. **Draft** — author writes and iterates.
2. **Review** — at least one decider from `@sovereign/deciders`
   plus one subject-matter expert from `@sovereign/security-team` or
   `@sovereign/sre` (depending on scope).
3. **Accepted** — implementation may begin.
4. **Superseded** — replaced by a later RFC.
5. **Rejected** — explicitly closed without adoption.

## Index

| RFC     | Title                                                  | Status     | Date       |
|---------|--------------------------------------------------------|-----------|------------|
| 0001    | Frozen cube update process                             | Accepted  | 2026-09-07 |
| 0002    | Multi-region active-active for sovereign artifacts     | Accepted  | 2026-09-07 |
| 0003    | Formal verification pipeline                            | Accepted  | 2026-09-07 |
| 0004    | Threat-modelling DSL                                    | Accepted  | 2026-09-07 |
| 0005    | Bug-bounty program scope                                | Accepted  | 2026-09-07 |
| 0006    | P2P mesh transport for offline mode                     | Accepted  | 2026-09-07 |
| 0007    | PQC migration plan                                      | Accepted  | 2026-09-07 |
| 0008    | Zero-Trust defaults for HTTP                            | Accepted  | 2026-09-07 |
| 0009    | Privacy-by-design reviews                               | Accepted  | 2026-09-07 |
| 0010    | GDPR automation contract                                | Accepted  | 2026-09-07 |

## Conventions

- File name: `NNNN-title-with-hyphens.md`.
- Header: `Status:`, `Date:`, `Authors:`, `Reviewers:`.
- A short prose **Summary**.
- **Motivation**, **Detailed Design**, **Drawbacks**,
  **Alternatives**, **Open Questions**, **References** sections.
- See `template.md` for the skeleton.