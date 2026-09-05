# Host Identity / Environment Fingerprint v0.1

Privacy-first local host identity for deterministic cache partitioning, diagnostics, reproducibility records, compatibility reports, and local agent attribution.

## Guarantees

- Zero runtime third-party dependencies.
- No network calls, process enumeration, cloud metadata, credential stores, browser profiles, SSH material, or device serials.
- Stable and volatile fields are explicitly separated.
- Stable identity is `sha256:<64 lowercase hex>` over canonical stable fields only.
- Environment data is opt-in and allowlisted; sensitive-looking names are rejected.
- Capability functions are execution seams and are never recursively validated or frozen as plain configuration.
- Returned fingerprints are deeply immutable.

## API

```js
import {
  fingerprintHost,
  compareHostFingerprints,
  serializeHostFingerprint,
} from './src/index.js';

const fingerprint = await fingerprintHost();
const same = compareHostFingerprints(fingerprint, fingerprint);
const serialized = serializeHostFingerprint(fingerprint);
```

## Opt-in environment fields

```js
await fingerprintHost({
  environment: {
    allowlist: ['APP_MODE'],
    values: { APP_MODE: 'production' },
  },
});
```

Sensitive patterns such as passwords, secrets, tokens, credentials, cookies, authorization values, API keys, and private-key names are rejected.

## Capability seams

The cube accepts explicit `platform`, `runtime`, `path`, `clock`, `serialize`, and `hash` capabilities. Use them to make tests deterministic or to adapt a host-specific observation without giving the cube broad discovery authority.

## Verification

`npm run test:host-identity-environment-fingerprint` runs the cube suite. The repository release gate additionally runs syntax checks, the full test suite, and the real-browser smoke test on Ubuntu, Windows, and macOS-15-Intel.
