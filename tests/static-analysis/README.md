# Deep Static Analysis — SonarQube / CodeQL

**Status:** Phase-3 / Continuity-Hardening Wave

Sovereign cubes are scanned by:

1. **SonarQube** rules (js,security,performance,reliability) — see
   `sonarqube/sonar-project.properties`.
2. **GitHub CodeQL** — see `codeql/codeql-config.yml`.
3. **Sovereign custom rules** — see `custom-rules/`. These are
   stdlib-only grep-equivalent rules that catch Sovereign-specific
   anti-patterns:

| Rule ID    | What it catches                                                       |
|------------|------------------------------------------------------------------------|
| `sov-001`  | Direct use of `eval`/`new Function`                                    |
| `sov-002`  | Hardcoded credentials / tokens                                         |
| `sov-003`  | Use of `fs.writeFileSync` for atomic-write patterns                    |
| `sov-004`  | Missing `LIMIT_EXCEEDED` checks on untrusted input                       |
| `sov-005`  | Path traversal candidates (`path.join(cwd, user_input)`)               |
| `sov-006`  | `innerHTML` / `outerHTML` assignment                                   |
| `sov-007`  | `child_process.exec` (use spawn)                                       |
| `sov-008`  | Plain `http` (use `https` or TLS)                                      |
| `sov-009`  | `Math.random` used in security context                                  |
| `sov-010`  | `==` (use `===`)                                                       |
| `sov-011`  | Missing `try`/`catch` around external I/O                              |
| `sov-012`  | Logging of full request/response bodies                                 |
| `sov-013`  | Use of `setTimeout` / `setInterval` with string argument                |
| `sov-014`  | Unbounded loop over user-controlled collection                          |
| `sov-015`  | Mismatch between declared exception type and `throw` shape              |

## Running

```
# CodeQL via Actions
.github/workflows/codeql.yml

# Custom rules
node scripts/static-analyse.mjs --out .hermes/phase3/static
```

`scripts/static-analyse.mjs` walks the source tree applying the
custom rules and emits a SARIF v2.1.0 file plus a JSON transcript.