# Sovereign Cube Formal Invariants — Index

Prose version of every machine-checked invariant. Each entry points
to the formal proof.

| ID     | Invariant                                                                                | Cube                                       | Proof                              |
|--------|-------------------------------------------------------------------------------------------|--------------------------------------------|------------------------------------|
| SP-1   | `resolve(root, candidate)` returns a path whose lexical ancestors are all inside `root`    | safe-path-resolver                         | `tla/SafePath.tla`                 |
| SP-2   | Adding a path to the allow-list never causes a previously-resolvable path to become unresolvable | safe-path-resolver                         | `tla/SafePath.tla`                 |
| SP-3   | Resolving `root` itself returns `root` exactly                                             | safe-path-resolver                         | `tla/SafePath.tla`                 |
| FL-1   | A leased file is held by at most one holder at any time                                   | file-lease-advisory-lock                   | `tla/FileLease.tla`                |
| FL-2   | If a holder is alive, every other holder that requests the lease eventually receives     | file-lease-advisory-lock                   | `tla/FileLease.tla`                |
|        | `LEASE_BUSY` or `LEASE_OK` (liveness)                                                     |                                            |                                    |
| RJ-1   | A `committed` journal entry is recoverable after crash                                    | filesystem-recovery-journal                | `tla/RecoveryJournal.tla`          |
| RJ-2   | Replaying a journal with no crash produces the same final state as a non-crashing run    | filesystem-recovery-journal                | `tla/RecoveryJournal.tla`          |
| CJ-1   | `canonicalJson(v)` produces the same bytes for all `v` in the same equivalence class      | canonical-json                             | `coq/CanonicalJson.v`              |
| AB-1   | `commit(batch)` either persists all files in `batch` or none                             | atomic-batch-file-transaction              | `coq/AtomicBatch.v`                |
| AB-2   | `commit(batch)` never leaves a partial write visible (no torn writes)                    | atomic-batch-file-transaction              | `coq/AtomicBatch.v`                |
| RA-1   | A release approval is valid only if at least two distinct approvers signed                | artifact-release-approval                  | `coq/ReleaseApproval.v`            |
| RA-2   | A release approval cannot be replayed (nonce + monotonic counter)                         | artifact-release-approval                  | `coq/ReleaseApproval.v`            |
| PC-1   | Any capability not in the allow-list is denied (deny-default)                             | policy-capability-security                 | `coq/PolicyCapability.v`           |

A formal-verification run is **complete** when every row above has a
passing transcript in `.hermes/phase3/formal/`.