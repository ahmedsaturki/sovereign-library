# Bug Bounty Program

**Status:** Phase-3 / Continuity-Hardening Wave

The Sovereign Library runs a public bug-bounty program to surface
vulnerabilities before they are exploited. This document is the
authoritative scope, rules, and reward table.

## Scope

**In scope:**

- Source code under `cubes/*/src/index.js`.
- Specs under `specs/*-v0.1.md`.
- CI workflows under `.github/workflows/` — for unauthorised token
  scope, secret leak, or RCE.
- Configuration under `ci/`, `security/`, `privacy/`, `architecture/`,
  `tests/`.

**Out of scope:**

- Performance issues without security impact.
- UI/UX issues.
- Issues requiring physical access to the device.
- Third-party dependencies themselves (they have their own programs).
- `examples/` and demo content.

## Severity & reward matrix

| Severity | Description                                                | Reward (USD) |
|----------|------------------------------------------------------------|--------------|
| Critical | Remote code execution, full auth bypass, key disclosure     | $5,000       |
| High     | Significant data exposure, integrity loss, privilege escal.| $1,000       |
| Medium   | Limited data exposure; mitigated by Zero Trust defaults    | $250         |
| Low      | Information leak; observability concerns                   | $50          |
| Info     | Best-practice deviation                                     | $0 (credit)  |

## Triage SLA

- **Acknowledgement**: within 24 hours of submission.
- **Severity confirmation**: within 7 days.
- **Patch SLA**: 30 days for High/Critical, 90 days for Medium/Low.
- **Disclosure**: 90-day coordinated disclosure window.

## Submission

Open a private advisory at
`https://github.com/sovereign/security-advisories/security` or email
`security@sovereign.example` (PGP-encrypted, key at
`/.well-known/pgp-key.asc`).

## Rules

1. Do **not** access data that is not yours.
2. Do **not** disrupt our services.
3. Do **not** social-engineer employees.
4. Stop on first significant finding and report it.
5. Do **not** publicly disclose before the patch is shipped or the
   disclosure window expires.

## Recognition

Submitters are credited in `docs/SECURITY_HALL_OF_FAME.md` (with
consent).