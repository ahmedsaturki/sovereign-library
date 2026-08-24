# Process / Command Cube v0.1

Released after the cross-platform CI gate passed on Ubuntu, Windows, and macOS.

## Native boundary

Runtime dependency count: 0 third-party packages.

Implementation uses Node.js `node:child_process` only.

## Scope

- explicit command + argv
- no-shell by default
- optional explicit shell mode
- stdout/stderr capture
- exit code and signal reporting
- cwd/env control
- timeout
- AbortSignal cancellation
- bounded output
- deterministic typed errors
