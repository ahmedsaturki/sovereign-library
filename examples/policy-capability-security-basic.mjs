import { createPolicyEngine } from '../cubes/policy-capability-security/src/index.js';

const policy = createPolicyEngine({
  rules: [
    { id: 'read-docs', effect: 'allow', action: 'fs/read', resource: 'docs/**' },
    { id: 'deny-secret', effect: 'deny', action: 'fs/read', resource: 'docs/secret' },
  ],
});

console.log(policy.evaluate({ action: 'fs/read', resource: 'docs/secret' }));
