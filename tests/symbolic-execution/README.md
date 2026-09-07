# Symbolic Execution — KLEE / Angr

**Status:** Phase-3 / Continuity-Hardening Wave
**Tools:** KLEE (LLVM), Angr (Python), SymCC (compile-time)

Symbolic execution verifies that **every reachable branch** in the
target program satisfies the assertion under all inputs. We use
symbolic execution to confirm the absence of off-by-one errors, NULL
derefs, and out-of-bounds reads in the critical kernels of frozen
cubes.

## Targets

| Cube                              | Notes                                                |
|-----------------------------------|------------------------------------------------------|
| safe-path-resolver                | KLEE on a C port; confirms lexical-containment       |
| file-lease-advisory-lock          | Angr on the JS byte-code extracted by Esprima        |
| atomic-file-writer-safe-replace   | KLEE on the rename(2)-wrapper C helper                |
| canonical-json                    | KLEE confirms deterministic encoding on all inputs   |
| bounded-file-content-reader       | KLEE confirms size-limit invariants                   |

## How to run

```
# Build the C port + run KLEE
bash scripts/symbolic-execute.sh \
  --target safe-path-resolver \
  --out .hermes/phase3/symbolic
```

The shell wrapper invokes `klee`, parses the resulting `.err` /
`.path` files, and emits a JSON transcript.

## What we DON'T symbolise

- I/O heavy cubes (process supervisor, application lifecycle).
- Anything that depends on `node:crypto` — symbolic execution
  cannot model SHA-256 without an SMT-encoded hash.

## Why also Angr?

KLEE needs C / LLVM. Angr works on VEX IR and accepts JS via Esprima
extraction. We use Angr as a complement to KLEE so we can symbolise
JS-native cubes too.