# Artifact Admission Gate / Release Eligibility v0.1

## Goal

A standalone deterministic gate that decides whether an explicit artifact record is eligible for a release according to explicit caller-supplied admission clauses.

## Inputs

- artifact record supplied directly by the caller
- gate configuration supplied directly by the caller
- optional compliance summary supplied as bounded evidence data

## Clause model

Each clause has:

- stable `id`
- `kind` (`required` or `optional`)
- `category`
- deterministic predicate
- bounded expected value
- optional evidence key

## Evaluation contract

1. validate all inputs before evaluation
2. reject accessors, circular values, duplicate clause ids, unsupported predicates, malformed configuration, and oversized inputs
3. evaluate required and optional clauses deterministically
4. required failures block admission; optional failures produce non-blocking reasons
5. produce one immutable verdict plus bounded evidence summaries
6. never mutate source inputs
7. serialize/parse results deterministically with a checksum-protected `SAG1` envelope
8. later valid evaluations recover after rejected input

## Built-in checks

- artifact id presence
- digest presence and exact digest
- semantic version format/basic range
- lifecycle eligibility
- provenance/lineage status
- compliance verdict (`compliant` / `non_compliant`)
- bounded metadata requirements
- custom scalar equality/membership/boolean predicates

## Safety / bounds

- finite maximum clause count
- finite maximum evidence count
- finite maximum string sizes
- finite metadata depth/node limits
- no arbitrary code execution
- no dynamic module loading

## Out of scope

- remote policy/gate retrieval
- network/filesystem/registry discovery
- automatic repair or publication
- signing/trust-chain verification
- scheduler/orchestration
- GUI/admin console

## Definition of done

SPEC, implementation, normal/failure/recovery tests, example, README, CHANGELOG, package registration, clean-checkout verification, and GitHub CI across Ubuntu, Windows, and macOS-15-Intel including real-browser smoke.

Release sequence:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`
