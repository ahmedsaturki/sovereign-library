# Runtime Capability Inspector v0.1

Standalone local runtime preflight and capability report cube.

## API

```js
import {
  inspectRuntime,
  evaluateRuntimeRequirements,
  serializeRuntimeReport,
  parseRuntimeReport,
} from './src/index.js';

const snapshot = inspectRuntime({ executables: ['node', 'git'] });
const verdict = evaluateRuntimeRequirements(snapshot, {
  os: ['linux', 'darwin'],
  nodeMajorMin: 24,
  requiredExecutables: ['node'],
});
```

## What it provides

The cube captures host/runtime facts such as OS family, architecture, Node.js version, CPU count, total memory, and bounded executable availability. It never returns environment variable values; environment inspection is reduced to capability booleans such as whether PATH is configured.

Executable availability is checked through filesystem metadata only. The cube never spawns the executable, invokes a shell, installs anything, or contacts the network.

The requirement evaluator is pure: it consumes a snapshot and declarative requirements and returns an immutable verdict with deterministic ordered failures.

## Safety

Accessor-backed objects, circular structures, unsupported values, duplicate requests, malformed requirements, oversized inputs, malformed serialization, and checksum corruption fail closed with typed `RuntimeCapabilityError` codes. Rejected calls do not modify global state, and later valid calls recover normally.

## Serialization

`serializeRuntimeReport` emits a versioned `RCI1` checksum-protected envelope. `parseRuntimeReport` verifies the SHA-256 checksum before accepting the payload.

## Limits

64 executable requests, 128 PATH entries, 32 entries per requirement list, 256-character executable names, 64 KiB serialized payloads, and 12 levels of object nesting.

## Dependencies and portability

Zero runtime third-party dependencies. Uses only Node.js standard-library modules. Targets Linux, Windows, macOS, and WSL where the underlying Node.js runtime is supported.
