# Cube Contract v1

Every standalone cube MUST define:

1. identity and semantic version
2. purpose and non-goals
3. public inputs and outputs
4. error model
5. resource limits
6. lifecycle and shutdown behavior
7. supported platforms
8. security boundaries
9. test matrix
10. definition of done
11. usage example
12. release artifact

## Independence rule

A cube must be runnable and testable without another Sovereign cube. Shared concepts are copied into the cube contract or represented by stable external formats. Composition happens at the application level, not by hidden internal coupling.

## Reference shape

```json
{
  "name": "cube.name",
  "version": "0.1.0",
  "input": {},
  "output": {},
  "error": {"code": "", "message": "", "retryable": false},
  "capabilities": [],
  "platforms": ["windows", "linux", "macos", "wsl"]
}
```

## Release gate

`RELEASED` means build + unit + integration + failure/recovery + platform + documentation + example checks all pass. No roadmap item is allowed to silently enter a release.
