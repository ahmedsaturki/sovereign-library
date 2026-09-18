# Filesystem Metadata / Stat Normalizer v0.1

Standalone cross-platform normalization of `lstat`/`stat` metadata into bounded immutable FMN1 records.

## Core operations

```js
import { normalizeStat, serializeMetadata, parseMetadata } from './src/index.js';

const metadata = await normalizeStat('/workspace/file.txt');
const wire = serializeMetadata(metadata);
const restored = parseMetadata(wire);
```

## Policies

- `lstat` — default; never follows symlinks.
- `stat` — follows the target through the injected `stat` capability.
- `contained` — follows only when the explicit containment capability approves the target.

Symlink targets are only reported when `includeSymlinkTarget` is explicitly enabled.

## Normalized contract

FMN1 records expose stable `kind`, size, allocation, mode, readonly, optional identity fields, normalized timestamps, coarse platform, symlink target, and observation method fields. Unsupported platform values become `null` rather than fabricated data.

## Safety

The cube enforces hard bounds on paths, symlink targets, metadata serialization, and diagnostics. Native numeric values must remain safe integers. Hostname, username, environment variables, network interfaces, and device identifiers are never read.

## Recovery

Missing and permission errors support `throw`, `return-null`, and `return-error`. The implementation is non-mutating and valid calls remain usable after a rejected observation.

## Serialization

`serializeMetadata()` emits deterministic `FMN1|1|` canonical JSON with a SHA-256 integrity suffix. `parseMetadata()` verifies the checksum and returns a frozen object.

Runtime dependencies: zero third-party packages.
