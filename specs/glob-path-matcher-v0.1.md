# Glob / Path Matcher v0.1

## Goal

Provide a standalone, deterministic, cross-platform path-pattern compiler and matcher for selecting paths without touching the filesystem.

The cube must be useful as a pure library for ignore rules, artifact selectors, package manifests, policy scopes, routing tables, and test filters.

The core does not enumerate directories, read files, execute shells, expand environment variables, or access the operating system.

## Public API

```js
compileGlob(pattern, options)
matchGlob(compiledPattern, path, options)
evaluateRules(rules, path, options)
normalizePath(path, options)
serializePattern(compiledPattern)
parsePattern(serialized)
```

The exact exported names may be adjusted during IMPLEMENT if the behavior remains equivalent and the SPEC is updated before release.

## Grammar

Supported pattern tokens:

- literal path characters
- `/` as the canonical separator
- `*` matches zero or more characters within one path segment
- `?` matches exactly one character within one path segment
- `**` as a complete path segment matches zero or more complete path segments
- `\\` is an escape character for a literal metacharacter when escape mode is enabled

`**` embedded inside ordinary characters is literal; recursive semantics apply only when the token occupies an entire path segment.

Unsupported shell features such as brace expansion, extglob, command substitution, character classes, tilde expansion, environment substitution, and shell evaluation are out of scope for v0.1.

## Path normalization

1. Matching uses `/` as the canonical separator on every supported platform.
2. Windows `\\` separators are normalized to `/` before matching.
3. Repeated separators are rejected by default rather than silently collapsed, except the single canonical root separator when absolute-path mode is enabled.
4. `.` segments are normalized away only when `normalizeDotSegments` is explicitly enabled.
5. `..` segments are never allowed to escape an explicit root scope. A caller may reject such paths or request root-bounded normalization; the pure matcher never consults the filesystem to resolve them.
6. Drive prefixes and UNC roots must be represented in a platform-neutral absolute-path form before matching when absolute patterns are used.

## Absolute vs relative semantics

Patterns and candidate paths are either both relative or both absolute unless `allowRelativeAgainstRoot` is explicitly enabled.

An absolute pattern is root-anchored and must not match a relative candidate.

A relative pattern matches relative candidates only by default. Root anchoring is explicit; there is no implicit working-directory lookup.

## Case sensitivity

Case behavior is an explicit option:

- `sensitive` — exact case
- `insensitive` — Unicode case-folded comparison for supported ASCII/Unicode code points

The matcher never infers case behavior from the host operating system.

Default: `sensitive`.

## Dot segments and hidden names

A leading `.` in a path segment has no implicit hidden-file semantics. `*` and `**` may match dot-prefixed names unless the caller enables an explicit `dotfiles: 'exclude'` policy.

Traversal safety is independent from hidden-name matching.

## Deterministic rule evaluation

Rule evaluation accepts ordered include/exclude rules.

Recommended rule form:

```js
{ pattern, action: 'include' | 'exclude' }
```

Rules are evaluated in declaration order; the last matching rule wins unless `firstMatchWins` is explicitly selected.

If no rule matches, the caller-specified default action applies. The result must identify the winning rule index for auditability.

Rule evaluation must never read the filesystem.

## Complexity and limits

The implementation must avoid unbounded backtracking from adversarial patterns.

Required default limits:

- maximum pattern length: 4096 UTF-16 code units
- maximum candidate path length: 32768 UTF-16 code units
- maximum path segments: 1024
- maximum compiled token count: 8192
- maximum rules per evaluation: 4096
- maximum rule pattern length: 4096
- maximum serialized matcher size: 256 KiB

Inputs beyond limits fail closed with typed error codes. Implementations should prefer linear-time or bounded-state matching where practical.

## Escaping

When escape mode is enabled:

- `\\*` matches a literal `*`
- `\\?` matches a literal `?`
- `\\\\` matches a literal `\\`
- an incomplete terminal escape is invalid

When escape mode is disabled, backslash is treated as a platform-normalized separator before tokenization.

Default: `escape: true` for the pattern grammar and `separatorNormalization: true` for candidate paths.

## Compilation

Compilation is deterministic. Equivalent source patterns under the same options must produce equivalent compiled representations.

Compiled matchers must be immutable.

Compilation must not capture ambient process state, current working directory, locale, environment variables, filesystem state, clock values, or randomness.

## Serialization

A versioned canonical serialization format must be provided for compiled matchers.

Serialization must be deterministic and integrity-checkable. Parsing must reject malformed, oversized, tampered, unsupported-version, or semantically invalid payloads.

## Failure model

Typed failures must cover at least:

- invalid pattern
- invalid escape sequence
- unsupported grammar feature
- path/pattern mismatch of mode (absolute vs relative)
- traversal escape
- size limit exceeded
- malformed serialized matcher
- serialization integrity mismatch
- unsupported serialization version
- circular/accessor/unsupported caller input

A failed match does not throw; it returns `false` or a structured non-match result. Configuration and compilation errors throw typed cube errors or return a structured error result according to the final API contract.

## Input safety

Plain configuration objects must be finite, JSON-safe, non-circular data.

Capability hooks are not configuration data. If an implementation exposes injected helper functions, those seams must be validated separately and must never be frozen, traversed, or serialized as plain data.

Accessor-backed values must fail closed where their execution could alter semantics or bypass validation.

## Cross-platform contract

The matcher must produce identical results for identical normalized inputs on:

- Ubuntu/Linux
- Windows
- macOS-15-Intel
- WSL where Node.js is supported

Differences in native OS path syntax are normalized before matching. Host filesystem case behavior, current directory, drive mounts, and separator conventions must not silently change the result.

## Standalone boundary

Zero runtime third-party dependencies.

The cube may use Node.js standard-library primitives for encoding, hashing, and validation, but the pure matcher core must remain filesystem-free and network-free.

## Out of scope

- filesystem traversal
- shell glob expansion
- shell command execution
- ignore-file parsing with repository-specific dialects
- brace expansion
- extglob
- character classes
- regex syntax in patterns
- environment-variable interpolation
- network/URL pattern matching
- persistent pattern storage
- GUI

## Required tests

### Normal path

- literal exact matches
- `*` within one segment
- `?` within one segment
- `**` across zero, one, and many segments
- escaped metacharacters
- absolute and relative patterns
- explicit case-sensitive and case-insensitive modes
- dotfile policy
- deterministic rule ordering and last-match-wins
- equivalent normalization across Windows/Unix separators
- serialization round-trip

### Failure and adversarial path

- malformed escapes
- unsupported constructs
- empty patterns
- empty candidate paths
- excessive lengths and segment counts
- recursive `**` stress cases
- traversal attempts with `..`
- mixed absolute/relative inputs
- invalid option values
- accessor-backed options
- circular inputs
- corrupted serialized matchers
- tampered integrity envelope
- unsupported serialization version

### Recovery

A rejected compile/match/parse operation must not poison a later valid operation using the same process. Compilation and matching must be side-effect free.

## Examples and documentation

Release must include:

- standalone README for the cube
- runnable example
- public API reference
- grammar table
- limits and security behavior
- cross-platform normalization examples
- failure/recovery examples
- changelog entry

## Definition of done

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Release requires the repository verification matrix to pass on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke, plus the cube-specific contract/failure/recovery suite.
