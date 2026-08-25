# Artifact Lifecycle / Retention Index v0.1

## Goal

Provide a standalone deterministic local lifecycle/retention index for artifact references. It models explicit lifecycle states, evaluates bounded retention policies, provides deterministic query and dry-run purge plans, persists state atomically, and never performs destructive physical deletion.

## Public contract

### Lifecycle states

`live`, `retained`, `expired`, `tombstoned`, `deleted`.

### Record

- stable artifact identifier
- lifecycle state
- createdAt / updatedAt as explicit safe integer milliseconds
- optional expiresAt
- bounded tags
- bounded references
- bounded metadata

### Transitions

Allowed transitions are explicit and deterministic:

- live -> retained | expired | tombstoned
- retained -> live | expired | tombstoned
- expired -> retained | tombstoned
- tombstoned -> deleted
- deleted is terminal

Any other transition fails closed and leaves state unchanged.

### Retention evaluation

A policy is a pure input describing age thresholds and optional tag selectors. Evaluation takes an explicit `now` timestamp and returns deterministic state suggestions without mutating records.

### Purge planning

Purge planning is dry-run only. It returns a deterministic bounded list of eligible identifiers and reasons. It does not delete or mutate physical artifacts.

### Persistence

- versioned serialized format
- canonical deterministic ordering
- checksum over canonical state
- atomic replacement when a file path is configured
- malformed, corrupt, truncated, unsupported, or accessor-bearing state fails closed

## Limits

- maximum record count
- maximum identifier/tag/reference lengths
- maximum metadata size
- maximum query/purge results
- maximum serialized state size

## Dependencies

Zero runtime third-party dependencies. Native Node.js standard-library primitives only.

## Out of scope

- destructive physical deletion
- remote synchronization
- network transport
- distributed locks
- billing or cost accounting
- GUI/admin console
- background scheduler integration
- legal/compliance retention policy engines

## Definition of done

1. SPEC committed
2. implementation complete
3. unit/contract/failure/recovery tests complete
4. cross-platform GitHub Actions pass on Ubuntu, Windows, and macOS-15-Intel
5. real-browser smoke gate passes
6. README, changelog, and runnable example are present
7. release merge is followed by clean `main` post-merge verification
8. control, roadmap, and README record release and freeze
