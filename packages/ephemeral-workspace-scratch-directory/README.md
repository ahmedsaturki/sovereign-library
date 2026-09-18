# Ephemeral Workspace / Scratch Directory v0.1

Standalone, dependency-free local scratch workspace primitive.

## API

```js
import { createWorkspace, recoverWorkspace } from './src/index.js';

const workspace = await createWorkspace({
  parent: '/tmp/my-app-workspaces',
  owner: { job: 'compile' },
  ttlMs: 60_000,
});

try {
  console.log(await workspace.path());
  console.log(workspace.workspaceId, workspace.expiresAt, workspace.isExpired());
  // caller may create files inside the workspace
} finally {
  await workspace.cleanup();
}
```

`cleanup()` is idempotent. `path()` refuses to operate after cleanup. The handle snapshot is immutable.

## Recovery

Recovery is deliberately conservative. It requires the exact `workspaceId` and `recoveryToken` recorded for that workspace, plus an expired TTL. A timestamp alone cannot authorize deletion.

```js
const result = await recoverWorkspace({
  parent: '/tmp/my-app-workspaces',
  workspaceId: 'workspace-12345678',
  recoveryToken: '...',
});
```

The default behavior is to leave abandoned workspaces untouched.

## Safety boundary

The cube validates the parent as a real directory, creates the workspace directly beneath it using native exclusive directory creation, records a deterministic identity record, rejects symlink replacement during cleanup, and removes only the exact recorded workspace subtree.

The core never interprets caller-created content files. It does not execute processes, watch files, coordinate over a network, or provide locking semantics.

## Platform note

Node.js standard-library filesystem operations are used. Native recursive removal is used only after the workspace identity is verified; platform-specific symlink semantics are intentionally handled by `lstat` before cleanup rather than by assuming identical filesystem behavior across operating systems.

## Limits and errors

Paths, identifiers, metadata, records, TTLs, and cleanup depth are bounded. Invalid accessors, circular values, unsupported JSON values, malformed/tampered records, path escapes, ownership mismatches, and unsafe recovery fail closed using immutable `WorkspaceError` codes.

Zero runtime third-party dependencies.