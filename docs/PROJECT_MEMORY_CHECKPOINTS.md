# Sovereign Library — Project Memory Checkpoints

This file is a durable append-only-style index of major milestone checkpoints. Detailed evidence belongs in the authoritative documents named below.

## Checkpoint Rules

- Record the exact relevant Git SHA.
- Record what changed and what was preserved.
- Record verification/CI evidence tied to that SHA.
- Record deferred/blocked work.
- Record the current official task and exactly one next task.
- Never rewrite history to make a checkpoint look cleaner.

## Current Checkpoint

See `PROJECT_CONTROL.md` for the current authoritative state.
See `docs/PROJECT_CONTINUITY_OPERATING_MODEL_V1.0.md` for the permanent continuity rules.
See `scripts/package-catalog.json` for package-level classification.

## Recovery

If a future session or agent starts here, read:

`AGENTS.md → PROJECT_CONTROL.md → ROADMAP.md → docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md → docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md`

Then verify the live GitHub branch/PR/CI state before acting.
