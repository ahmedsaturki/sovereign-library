import { acquireLease } from '../cubes/file-lease-advisory-lock/src/index.js';

const lease = await acquireLease({
  resourcePath: './sovereign-demo-resource',
  lockPath: './sovereign-demo-resource.sovereign-lease',
  ttlMs: 30_000,
  staleRecovery: true,
  owner: { example: 'file-lease-demo' },
});

console.log(JSON.stringify({ leaseId: lease.leaseId, state: lease.state, expiresAt: lease.expiresAt }, null, 2));
await lease.release();
