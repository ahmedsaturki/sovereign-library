# Responsible Disclosure Policy

**Status:** Phase-3 / Continuity-Hardening Wave

We follow a **90-day coordinated disclosure** policy. After the
window expires, the reporter may publish regardless of patch status.

## Flow

1. Reporter opens a private advisory (`.well-known/security.txt`).
2. Sovereign security team acknowledges within 24h.
3. Triage determines severity (Critical/High/Medium/Low/Info).
4. Patch is developed in private.
5. Patch is released with a CVE ID.
6. After 90 days (or sooner with mutual agreement), the reporter
   may publish.

## CVE IDs

We request CVE IDs via GitHub Security Advisories — the GHSA
becomes the public record once the patch ships.

## Embargo

A CVE embargo is honoured for the patch window (typically ≤30 days)
or until the reporter agrees to lift it.

## What we promise

- We will **not** pursue legal action against researchers who act
  in good faith.
- We will credit reporters (with consent) in
  `docs/SECURITY_HALL_OF_FAME.md`.
- We will not silence the researcher after disclosure.