# Mutation Testing

**Status:** Phase-3 / Continuity-Hardening Wave

Mutation testing verifies that the test suite is *strong enough* to
catch realistic changes. We inject small mutations into the
production code and check that *some* test fails; if no test fails,
the test suite is too permissive — the code is "over-tested" in the
sense of coverage, "under-tested" in the sense of discriminating
power.

## Tooling

We use a **stdlib-only mutator** (`scripts/mutate.mjs`) because the
Sovereign Library is dependency-free. The mutator applies
**mutation operators** from `mutators/` to a copy of the source and
re-runs the test suite.

| Operator                  | What it does                                    |
|---------------------------|--------------------------------------------------|
| `flip-equality`           | `===` ↔ `!==`, `==` ↔ `!=`                       |
| `flip-bool`               | `true` ↔ `false`                                 |
| `flip-comparison`         | `<` ↔ `<=`, `>` ↔ `>=`                           |
| `remove-early-return`     | drop a single `if (...) return`                  |
| `invert-condition`        | `if (a)` ↔ `if (!a)`                             |
| `swap-arithmetic`         | `+` ↔ `-`, `*` ↔ `/`                             |
| `nullify-return`          | replace a returned value with `null`             |
| `invert-logical`          | `&&` ↔ `\|\|`, `!a` ↔ `a`                       |
| `swap-loop-bound`         | `<` ↔ `<=` in a for-loop guard                   |
| `remove-throw`            | drop a single `throw` statement                  |
| `add-bound`               | add `+ 1` to a numeric literal                   |

## How to run

```
node scripts/mutate.mjs --target cubes/safe-path-resolver-containment-boundary \
  --out .hermes/phase3/mutation --operators flip-equality,flip-bool
```

## Mutation score

`mutation_score = killed / total`. We require >= 0.7 (70%) on every
frozen cube before a release; < 0.7 triggers a blocker labelled
`mutation-low-score`.

## Why a custom mutator?

The libraries that already exist (`mutmut` for Python, `Stryker` for
JS) require build tooling the Sovereign Library does not depend on.
Our mutator is intentionally small and applies one operator at a
time, producing an audit-friendly JSON transcript.