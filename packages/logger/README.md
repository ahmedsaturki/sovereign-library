# Logger / Diagnostics Cube v0.1

Native, standalone structured logging and diagnostics primitives.

## Runtime dependencies

None outside the Node.js runtime.

## Core API

- `Logger`
- `InMemorySink`
- `ConsoleSink`
- `LoggerCubeError`

`Logger` supports trace/debug/info/warn/error/fatal, minimum-level filtering, inherited child context, bounded record serialization, error normalization, sink failure isolation, and separate wall-clock (`ts`) and monotonic (`monoMs`) values.
