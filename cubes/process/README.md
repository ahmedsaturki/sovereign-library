# Process / Command Cube v0.1

Standalone process execution capability using only Node.js standard-library process and child-process primitives.

## Scope

- spawn a command with explicit argv
- capture stdout/stderr
- exit-code and signal reporting
- timeout and cancellation
- bounded stdout/stderr output
- environment and working-directory control
- deterministic typed errors
- no shell by default
- explicit shell opt-in

## Non-goals

No task scheduler, workflow engine, package manager, remote execution, shell framework, or third-party runtime dependency.

## Dependency policy

Runtime third-party dependencies: **0**.
