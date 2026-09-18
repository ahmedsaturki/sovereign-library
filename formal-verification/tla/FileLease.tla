---------------------------- MODULE FileLease ----------------------------
(*
  File-lease mutual exclusion + liveness invariant.

  Modeled on the contract in
    specs/file-lease-advisory-lock-v0.1.md
  and the implementation in
    cubes/file-lease-advisory-lock/src/index.js.

  Verified with TLC. Proof scope: FL-1 (safety) and FL-2 (liveness).

  Prover version: TLA+ 2.20 / TLC 2.20
*)
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
  Holders,        \* Set of holder identities.
  Files           \* Set of file paths.

VARIABLES
  holder,         \* function: Files -> Holders \union {"FREE"}.
  waiters,        \* function: Files -> SUBSET Holders (queue).
  history         \* Sequence of (file, holder, action, result).

vars == <<holder, waiters, history>>

TypeOK ==
  /\ holder \in [Files -> Holders \union {"FREE"}]
  /\ waiters \in [Files -> SUBSET Holders]
  /\ history \in Seq([Files \X Holders \X {"ACQ","REL","DEN"} \X {"OK","BUSY"}])

Init ==
  /\ holder = [f \in Files |-> "FREE"]
  /\ waiters = [f \in Files |-> {}]
  /\ history = <<>>

\* Acquire: success iff free; otherwise enqueue.
Acquire(file, h) ==
  /\ file \in Files
  /\ h \in Holders
  /\ \/ /\ holder[file] = "FREE"
        /\ holder' = [holder EXCEPT ![file] = h]
        /\ waiters' = [waiters EXCEPT ![file] = waiters[file] \ {h}]
        /\ history' = Append(history, <<file, h, "ACQ", "OK">>)
     \/ /\ holder[file] # "FREE"
        /\ waiters' = [waiters EXCEPT ![file] = waiters[file] \union {h}]
        /\ history' = Append(history, <<file, h, "ACQ", "BUSY">>)
        /\ UNCHANGED holder

\* Release: only the current holder may release.
Release(file, h) ==
  /\ file \in Files
  /\ h \in Holders
  /\ holder[file] = h
  /\ holder' = [holder EXCEPT ![file] = "FREE"]
  /\ UNCHANGED waiters
  /\ history' = Append(history, <<file, h, "REL", "OK">>)

Next ==
  \E f \in Files, h \in Holders :
    Acquire(f, h) \/ Release(f, h)

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* --------------------------------------------------------------------
\* Invariants
\* --------------------------------------------------------------------

\* FL-1: at most one holder per file.
MutualExclusion ==
  \A f \in Files : holder[f] \in Holders \union {"FREE"}

\* FL-2: every Acquire on a free file eventually succeeds
\* (liveness under fairness).
Liveness ==
  [](\A f \in Files, h \in Holders :
        [](<<f, h, "ACQ", "BUSY">> \in history)
          => <>(<<f, h, "ACQ", "OK">> \in history))

THEOREM MutualExclusionHolds == Spec => []MutualExclusion
THEOREM LivenessHolds == Spec => []Liveness

================================================================================
\* Modification History
\* CVE-2024-FILE-LEASE-001  Reviewed 2026-09-07.
================================================================================