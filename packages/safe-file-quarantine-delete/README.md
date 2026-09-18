# Safe File Quarantine / Delete v0.1

Standalone, dependency-free local filesystem primitive for **quarantine, restore, and explicit permanent purge**.

## API

```js
import { quarantineItem, restoreQuarantined, purgeQuarantined } from './src/index.js';

const receipt = await quarantineItem('/data/report.pdf', {
  quarantineRoot: '/var/lib/sovereign-quarantine',
});

await restoreQuarantined(receipt);
// or, only when permanent deletion is intentional:
await purgeQuarantined(receipt);
```

## Safety model

Quarantine is the default destructive boundary: the source is moved into a unique quarantine directory using native rename semantics. The cube never falls back to copy-then-delete across filesystems.

Permanent deletion is possible only for a validated quarantine receipt whose manifest integrity and identity match the requested object.

Restore never overwrites an existing destination. Source symlinks are rejected. Relative paths require an explicit root. The source and quarantine roots must be disjoint.

When manifest persistence fails after a successful move, the implementation attempts a bounded rollback and reports rollback/cleanup status without masking the primary failure.

## Guarantees and limits

The receipt uses the versioned `SFQ1` format and is immutable. Manifest integrity uses native SHA-256. Diagnostics are bounded and do not copy native error text, file contents, or identity metadata into default errors.

The cube does not claim crash durability, distributed locking, cross-device atomicity, encryption, backup, or forensic recovery.

## Platform behavior

The release target is Ubuntu, Windows, and macOS-15-Intel, with conservative WSL behavior where the underlying filesystem supports the requested capability. Cross-device moves fail closed.

## Dependencies

No runtime third-party dependency is required. The implementation uses Node.js standard-library primitives and the existing Safe Path Resolver capability boundary.
