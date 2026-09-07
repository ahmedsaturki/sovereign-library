# CI Revalidation — Safe-Path Boundary Wave v0.1

## Purpose

Record a deterministic revalidation point after the safe-path dependency-boundary qualification and Browser syntax repair.

## Current branch

`feat/continuity-hardening`

## Verification target

The pull-request verification workflow must evaluate the current PR merge ref from the current branch tip, not a stale merge ref created before the latest repair commit.

## Required gates

1. Syntax check on Node 24.
2. Bounded contract and integration tests.
3. Declaration verification.
4. Package tooling verification.
5. Reproducible package verification.
6. Security boundary verification.
7. Publication guard.
8. Real browser smoke test.

## Safe-path qualification evidence

The dedicated qualification run completed successfully with 72 passing tests and zero failures, followed by successful package tooling, reproducibility, and security checks for the previously Conditional safe-path consumers and the existing safe-path/runtime-capability package candidates.

## Release rule

No release is marked complete until the general verification workflow passes on Ubuntu, Windows, and macOS-15-Intel for the current PR state.
