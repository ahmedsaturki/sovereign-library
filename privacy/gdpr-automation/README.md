# Privacy by Design & GDPR Automation

**Status:** Phase-3 / Continuity-Hardening Wave

Sovereign cubes that handle personal data opt in to **Privacy by
Design** and **GDPR Article 17/20** automation.

## Pillars (per GDPR Art. 25)

1. **Lawfulness, fairness, transparency** — declared data classes.
2. **Purpose limitation** — declared purpose per data class.
3. **Data minimisation** — collect only what is declared.
4. **Accuracy** — redaction for stale data.
5. **Storage limitation** — TTL per data class.
6. **Integrity & confidentiality** — encryption at rest, TLS in
   transit.
7. **Accountability** — audit log per processing event.

## What is automated

For every cube that declares a `personal-data` class:

- **Right to erasure** (Art. 17) — `scripts/gdpr-erasure.mjs` removes
  the record by subject id.
- **Data portability** (Art. 20) — `scripts/gdpr-portability.mjs`
  exports a JSON archive of the subject's data.
- **Consent management** — `scripts/gdpr-consent.mjs` records
  consent state and expiry.
- **Retention** — `scripts/gdpr-retention.mjs` enforces TTL.

## Data classes

| Class                  | Example                 | GDPR automation |
|------------------------|--------------------------|------------------|
| `personal-data`        | User email, name         | Required         |
| `sensitive-personal`   | Health, biometric        | Required         |
| `non-personal`         | Logs, metrics            | Not required     |
| `aggregated-anonymous` | Counts, statistics       | Not required     |

## How to declare

A cube declares its data class by adding a `data-classes.json` in
its root. Example:

```json
{
  "data_classes": ["personal-data"],
  "fields": {
    "user_email": "personal-data",
    "request_body": "non-personal"
  }
}
```

`scripts/gdpr-scan.mjs` walks the tree, ensures every cube with
personal data has the automation wired in, and emits a transcript.

## Run

```
node scripts/gdpr-automation.mjs --out .hermes/phase3/gdpr
```