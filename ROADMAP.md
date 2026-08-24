# Sovereign Library Roadmap

## v0.1 — Browser Cube foundation

**Goal:** one genuinely usable standalone cube, not a framework skeleton.

- [x] standalone product contract
- [x] native Chromium/CDP foundation
- [x] launch/attach lifecycle
- [x] navigation
- [x] page evaluation
- [x] metadata
- [x] screenshot
- [x] deterministic errors
- [x] cleanup
- [x] unit tests for contract/lifecycle
- [ ] platform smoke matrix
- [ ] release artifact verification

The two unchecked items are release gates, not invitations to expand scope.

## After v0.1

Only after Browser Cube passes its release gate do we start the next standalone product. Candidates are HTTP Client, Data Engine, Scheduler/Task Runner, Filesystem Engine, and Storage Engine.

Every candidate follows the same rule: **complete standalone product first; composition second.**
