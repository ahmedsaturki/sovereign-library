# Policy / Capability Security Cube

Standalone deterministic local policy evaluator for capability authorization decisions.

## Contract

The cube evaluates explicit `allow` / `deny` rules against an action, resource, and optional bounded context. No ambient identity, environment, network service, or external authorization SDK is consulted.

Patterns use `/`-separated segments where `*` matches one segment and `**` matches zero or more. Precedence is deterministic: priority, then pattern specificity, then deny, then rule id.

## Example

```js
import { createPolicyEngine } from './src/index.js';

const policy = createPolicyEngine({
  rules: [
    { id: 'docs-read', effect: 'allow', action: 'fs/read', resource: 'docs/**' },
    { id: 'secret-deny', effect: 'deny', action: 'fs/read', resource: 'docs/secret' },
  ],
});

console.log(policy.evaluate({ action: 'fs/read', resource: 'docs/secret' }));
```

## Safety

Inputs, rules, context, snapshots, and audit records are immutable at the API boundary. Accessors, circular values, malformed patterns, duplicate rule ids, unsupported values, and bound violations fail closed with typed `PolicyError` diagnostics.

## Dependencies

Zero runtime third-party dependencies.
