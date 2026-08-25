import { readFile } from 'node:fs/promises';
import { createWorkspace, recoverWorkspace } from '../cubes/ephemeral-workspace-scratch-directory/src/index.js';

const workspace = await createWorkspace({
  owner: { example: 'ephemeral-workspace' },
  ttlMs: 30_000,
});

try {
  console.log('workspace:', await workspace.path());
  console.log('id:', workspace.workspaceId);
  console.log('expires:', workspace.expiresAt);
  const record = JSON.parse(await readFile(`${await workspace.path()}/.workspace.json`, 'utf8'));
  console.log('record format:', record.format);
} finally {
  await workspace.cleanup();
}

void recoverWorkspace;
