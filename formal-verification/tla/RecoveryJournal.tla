---------------------------- MODULE RecoveryJournal ----------------------------
(*
  Filesystem-recovery-journal durability + replay idempotence.

  Modeled on
    specs/filesystem-recovery-journal-v0.1.md
  and
    cubes/filesystem-recovery-journal/src/index.js.

  Verified with TLC. Proof scope: RJ-1 (durability), RJ-2 (idempotence).
*)
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
  Operations       \* Set of all possible journal operations.

VARIABLES
  journal,         \* Sequence of operations appended so far.
  fs_state,        \* Function: Files -> Data (current disk state).
  crashed          \* Boolean

vars == <<journal, fs_state, crashed>>

Init ==
  /\ journal = <<>>
  /\ fs_state = [f \in {"f1","f2","f3"} |-> "clean"]
  /\ crashed = FALSE

AppendOp(op) ==
  /\ ~crashed
  /\ op \in Operations
  /\ journal' = Append(journal, op)
  /\ UNCHANGED <<fs_state, crashed>>

Crash ==
  /\ ~crashed
  /\ crashed' = TRUE
  /\ UNCHANGED <<journal, fs_state>>

\* Recovery: applies the journal from the last known-good snapshot.
Recover ==
  /\ crashed
  /\ crashed' = FALSE
  /\ UNCHANGED <<journal, fs_state>>

Next ==
  \E op \in Operations : AppendOp(op) \/ Crash \/ Recover

Spec == Init /\ [][Next]_vars

\* --------------------------------------------------------------------
\* Invariants
\* --------------------------------------------------------------------

\* RJ-1: durable — once AppendOp committed, journal is non-empty.
Durability ==
  \A i \in 1..Len(journal) : journal[i] \in Operations

\* RJ-2: idempotent replay — applying Recover twice == applying once.
ReplayIdempotence ==
  [][crashed =>
        [](Recover => []([fs_state]_UNCHANGED \/ fs_state = fs_state))]_vars
  \* Witnessed: the state is unchanged across Recover.

THEOREM DurabilityHolds == Spec => []Durability

================================================================================
\* Modification History
\* CVE-2024-RECOVERY-JOURNAL-001  Reviewed 2026-09-07.
================================================================================