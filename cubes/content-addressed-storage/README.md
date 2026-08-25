# Content-Addressed Storage / CAS v0.1

Standalone local content-addressed storage with deterministic SHA-256 addresses, bounded objects, immutable metadata, corruption detection, safe paths, and no runtime third-party dependencies.

## Example

```js
import { CasStore } from './src/index.js';
const store = await new CasStore({ root: './data' }).open();
const address = await store.put('hello');
console.log(address, new TextDecoder().decode(await store.get(address)));
```

The store is intentionally local and deterministic. Remote replication, encryption, registries, and network transport are out of scope for v0.1.
