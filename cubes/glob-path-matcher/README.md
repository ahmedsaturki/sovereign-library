# Glob / Path Matcher v0.1

Standalone, deterministic path-pattern matching with no filesystem access and zero runtime third-party dependencies.

## Core API

```js
compileGlob(pattern, options)
matchGlob(compiled, candidatePath, options)
evaluateRules(rules, candidatePath, options)
normalizeCandidatePath(path, options)
serializePattern(compiled)
parsePattern(serialized)
```

The matcher supports literals, `*`, `?`, segment-level `**`, explicit escaping, canonical `/` separators, explicit case policy, dotfile policy, deterministic include/exclude rule evaluation, bounded input sizes, and integrity-protected serialization.

## Important boundary

This is **not** a shell glob expander. It does not execute commands, inspect the filesystem, resolve the current working directory, read environment variables, or perform filesystem traversal.

## Cross-platform behavior

Backslashes are normalized to `/` for matching when separator normalization is enabled. Case sensitivity is explicit and never inferred from the host OS. Absolute and relative paths remain distinct by default.

## Failure behavior

Malformed patterns, invalid escapes, traversal escapes, oversized inputs, circular/accessor-backed option objects, malformed serialized matchers, and integrity mismatches fail closed with typed `GlobPathMatcherError` codes.

A failed match returns `false`; it never performs external side effects.

## Security / complexity

The recursive matcher uses bounded memoized state rather than unbounded regex-style backtracking. Pattern, candidate, segment, token, rule, and serialized sizes are capped.
