# CLI / Command Runtime Cube v0.1 Specification

## Product

A standalone native command-line runtime for deterministic parsing, validation, dispatch, help/version rendering, bounded standard I/O, explicit environment access, and predictable exit semantics.

## Supported value domain

- argv is an array of UTF-16 JavaScript strings supplied by the host process.
- Option names are ASCII tokens beginning with `-` or `--` and are matched case-sensitively.
- Option values are strings at the parser boundary and may be converted to typed values by explicit option definitions.
- Subcommand names and positional arguments are bounded strings.

## Parser semantics

- Short options: `-v`, `-q`, and grouped boolean flags such as `-vq`.
- Long boolean flags: `--verbose`.
- Long options with values: `--output file.txt` and `--output=file.txt`.
- Short options with values: `-o file.txt` and `-ofile.txt`.
- `--` ends option parsing; subsequent tokens are positional arguments.
- Unknown options fail closed with a typed error.
- Duplicate scalar options fail closed unless explicitly configured as repeatable.
- Repeatable options preserve argv order.
- Missing required values fail closed.
- Boolean flags do not consume the next token.

## Command model

Each command defines:

- name
- description
- options
- positional policy
- handler
- optional subcommands

Dispatch is deterministic by first matching command token. Ambiguous command definitions are rejected during runtime configuration validation.

## Typed values

Supported v0.1 converters:

- string
- boolean
- integer
- number
- enum

Invalid conversions produce typed command errors without embedding arbitrary input values in messages.

## Help and version

- `--help` and `-h` return an informational result with exit code `0`.
- `--version` returns an informational result with exit code `0`.
- Help output is deterministic and generated from the immutable command definition.

## Standard I/O

The runtime receives an explicit I/O object with `stdin`, `stdout`, and `stderr` writable/readable interfaces. The core does not directly access process-global streams unless explicitly requested by the adapter layer.

Output is bounded by `maxOutputBytes`. Writes after the bound fail closed.

## Environment

Environment access is explicit. A command may declare an allowlist of variable names. Reads outside the allowlist fail with a typed error. No environment mutation is performed by the core.

## Exit semantics

- success: `0`
- usage/argument error: `2`
- command handler failure: configured deterministic nonzero code, default `1`
- abort/cancellation: `130`

The core returns structured results; a thin process adapter may call `process.exitCode` but must not terminate the process from library internals.

## Safety and bounds

Default limits:

- max argv tokens: 1024
- max token UTF-8 bytes: 64 KiB
- max option definitions per command: 128
- max subcommands per command: 128
- max output UTF-8 bytes: 1 MiB
- max environment key length: 256 bytes
- max environment value length: 64 KiB

All limits are positive safe integers and configuration is deeply immutable.

## Failure semantics

Errors are instances of a typed `CliError` with stable codes and safe metadata. Error messages must not copy arbitrary user payloads, secrets, or environment values.

The parser must reject malformed definitions and ambiguous configurations before dispatch.

## Cross-platform contract

The core uses only JavaScript/Node standard APIs. No shell-specific parsing, external CLI frameworks, or platform-specific executables are required. A process adapter may bridge host streams and environment variables on Windows, Linux, macOS, and WSL.

## Dependency contract

Zero runtime third-party dependencies.

## Definition of done

- standalone README and example
- immutable configuration
- deterministic parser and dispatcher
- typed failures and safe diagnostics
- bounded arguments and output
- explicit environment allowlisting
- standard I/O abstraction
- source/config immutability
- unit, contract, integration, failure, recovery tests
- cross-platform CI and existing real-browser smoke gate
