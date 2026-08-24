# Sovereign Library Roadmap

## Current release — v0.1 Browser Cube

**Objective:** finish one standalone, dependency-free browser product and stop. Do not expand the catalog until this release gate passes.

### Completed

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

### Remaining release gates

- [ ] run full repository tests from a clean checkout/install
- [ ] platform smoke matrix for Windows/Linux/macOS/WSL where supported
- [ ] verify example from the README from a clean environment
- [ ] verify release artifact contents and reproducibility
- [ ] fix only defects required by the above gates
- [ ] tag/finalize v0.1

## Active milestone

`BROWSER-V0.1-RELEASE`

**Only immediate goal:** close the remaining release gates above.

## Next cubes — parked until Browser v0.1 is released

1. HTTP Client Cube
2. Filesystem Cube
3. Process/Command Cube
4. Data Engine Cube
5. Storage Cube
6. Scheduler/Task Runner Cube
7. WebSocket Cube
8. HTTP Server Cube
9. CLI Cube
10. Reporting Cube
11. Search Cube
12. Workflow Cube
13. AI Cube
14. Agent Cube

The order is provisional and can be changed only through an explicit decision after the current cube is released.

## Non-negotiable project rule

**One cube at a time. One active milestone. One immediate next task.**

Every cube follows:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is not considered complete because the code exists. It is complete only when its release gates pass.
