# Artifact Reference Resolver / Locator v0.1

Standalone deterministic local artifact reference parser and resolver.

## Guarantees

- zero runtime third-party dependencies
- explicit caller-supplied candidate set only
- no network, registry, filesystem scanning, or hidden global lookup
- deterministic normalization and ordering
- exact version, digest, tag, and unambiguous name resolution
- explicit `REFERENCE_NOT_FOUND` and `AMBIGUOUS_REFERENCE` failures
- bounded inputs and candidate/result counts
- accessor/circular/unsupported input rejection before evaluation
- immutable configuration, snapshots, references, and results
- failed calls do not poison later valid resolution

## Example

```js
import { createArtifactReferenceResolver } from './src/index.js';

const resolver = createArtifactReferenceResolver({
  candidates: [
    { id: 'core-1', name: 'core.lib', version: '1.2.3', digest: `sha256:${'a'.repeat(64)}`, tags: ['stable'] },
  ],
});

const result = resolver.resolve('core.lib@stable');
console.log(result.matches[0].id);
```

The cube performs no semantic version range solving. All matching is exact and deterministic.
