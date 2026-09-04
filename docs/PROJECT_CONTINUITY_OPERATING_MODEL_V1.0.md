# Sovereign Library — Project Continuity Operating Model v1.0

## Purpose

This document defines the permanent continuity rule for Sovereign Library: the repository is the durable memory and source of truth for project state. Important knowledge must not depend on a chat session, model memory, local workspace, or a specific agent.

## Permanent Principles

1. **Additive evolution by default.** Extend, harden, improve, supersede, deprecate, archive, or defer before deleting or replacing. Any necessary removal must preserve the historical reason.
2. **GitHub is persistent memory.** Meaningful engineering, architectural, security, release, dependency, platform, and roadmap decisions must be written to the repository.
3. **No local-only completion.** A meaningful milestone is complete only after the relevant evidence is recorded, committed, pushed, and remotely reconciled.
4. **One source of truth per concern.** Current state belongs in `PROJECT_CONTROL.md`; long-term direction in `ROADMAP.md`; behavioral contracts in SPECs; architecture law in the Architecture Constitution; distribution policy in the Ecosystem Contract; release evidence in `docs/release/`.
5. **History is preserved.** Old commits, failures, fixes, and superseded approaches remain visible as historical evidence.
6. **Actual GitHub state beats stale documentation.** When a SHA, CI result, PR state, or branch reference conflicts with an old report, verify live GitHub and then reconcile the current-state documentation without rewriting history.

## Mandatory Work Loop

**UNDERSTAND → INSPECT → SPECIFY → IMPLEMENT → TEST → FIX → VERIFY → DOCUMENT → PERSIST → COMMIT → PUSH → CI → RECONCILE → NEXT**

## Recovery Protocol

When resuming after interruption, read `AGENTS.md`, `PROJECT_CONTROL.md`, `ROADMAP.md`, and the relevant architecture/knowledge/release documents, then verify the live GitHub graph before taking action. Do not reconstruct state from memory or from an old chat transcript.

## Compatibility and Preservation

A new language, platform, package format, release channel, or Product is an addition unless an explicit recorded architecture decision supersedes an existing capability. Do not silently remove Node.js support, add Python/Kotlin/Android/iOS support in a way that breaks existing contracts, or convert deferred work into deleted work.

## Library Independence

A suitable Cube must be a real standalone library: independently usable, testable, packageable, distributable, versioned, documented, and explicitly dependency-bound. Products may compose Cubes but must not make their underlying packages depend on the monorepo.

## Distribution Policy

The current distribution policy is **GitHub-only**. External registries are deferred by policy. Package contracts and independent packaging remain important even when the distribution channel is GitHub.

## Definition of a Durable Milestone

A milestone is durable when:

- the implementation is present;
- tests/verification evidence exists;
- the correct source-of-truth documents are updated;
- a commit records the change;
- the commit is pushed;
- the remote branch and PR state are reconciled;
- any CI result is tied to the exact relevant commit.

## Agent Obligation

Any agent operating on Sovereign Library must preserve these continuity rules. A future agent should be able to understand the project and resume the active task from the repository alone.
