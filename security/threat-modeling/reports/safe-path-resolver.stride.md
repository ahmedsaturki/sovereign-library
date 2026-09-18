# STRIDE — safe-path-resolver

**Cube:** safe-path-resolver
**Last reviewed:** '2026-09-07'
**Reviewer:** '@sovereign/fellow-engineer'

## Threats

| # | Category | Threat | Mitigation | Status |
|---|----------|--------|------------|--------|
| 1 | name: "S - Spoofing: a caller passes root='/etc' but claims root='/data'" |  | — | — |
| 2 | name: "T - Tampering: candidate path contains '..' that escapes root" |  | — | — |
| 3 | name: "R - Repudiation: caller denies that resolve was invoked" |  | — | — |
| 4 | name: "I - Information Disclosure: error messages reveal absolute paths" |  | — | — |
| 5 | name: "D - Denial of Service: long paths cause CPU exhaustion" |  | — | — |
| 6 | name: "E - Elevation of Privilege: symlink traversal bypasses containment" |  | — | — |
