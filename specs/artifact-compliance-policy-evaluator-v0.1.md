# Artifact Compliance / Policy Evaluator v0.1

## Goal

A standalone deterministic evaluator for explicit artifact records against explicit caller-supplied policy rules.

## Inputs

- artifact snapshots supplied directly by the caller
- explicit rule definitions supplied directly by the caller
- no discovery or remote policy retrieval

## Rule model

Each rule has:

- stable `id`
- `category`
- `severity`
- `field` or predicate target
- deterministic operator
- bounded expected value/configuration
- optional remediation hint as data only

Supported v0.1 checks are limited to identity, digest, version, lifecycle, lineage, metadata fields, and bounded string/numeric constraints.

## Evaluation contract

1. validate rule and artifact inputs before evaluation
2. reject accessors, circular values, duplicate rule ids, invalid regular expressions, oversized inputs, and unsupported values
3. canonicalize rules deterministically
4. evaluate every applicable rule without mutating source data
5. classify each violation by stable rule id/category/severity
6. return immutable bounded findings in deterministic order
7. expose counts and an overall deterministic verdict
8. serialize the report deterministically with a checksum-protected envelope
9. parse/verify reports fail closed on corruption or unsupported format versions
10. later valid evaluations remain usable after rejected inputs

## Safety / bounds

- finite maximum rule count
- finite maximum artifact count
- finite maximum findings
- finite maximum rule/value string lengths
- finite metadata depth/node bounds
- regex pattern length and execution-safety restrictions
- no arbitrary code execution from rules

## Out of scope

- remote policy engines
- network/filesystem/registry discovery
- automatic mutation or repair
- distributed evaluation
- signature/trust-chain validation
- GUI/admin console

## Definition of done

SPEC, implementation, normal/failure/recovery tests, deterministic examples, README, CHANGELOG, package registration, clean-checkout verification, and GitHub CI on Ubuntu, Windows, and macOS-15-Intel including real-browser smoke.

Release sequence:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`
