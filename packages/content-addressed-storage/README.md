# Content-Addressed Storage / CAS v0.1

Standalone local content-addressed object storage using native Node.js primitives.

## Contract

Objects are addressed by SHA-256 of their exact bytes. Reads verify the stored digest before returning data. Writes are atomic at the object-file boundary, metadata is bounded and validated, and public values are immutable snapshots where applicable.

Runtime dependencies: none.

## Example

```js
import { CasStore } from './src/index.js';

const store = await new CasStore({ root: './.cas' }).open();
const address = await store.put('hello sovereign');
const value = await store.get(address);
console.log(address, new TextDecoder().decode(value));
```

## Safety

Unsafe addresses, accessor-bearing configuration/metadata, unsupported values, oversized payloads, corrupt stored bytes, missing objects, and closed stores fail with typed errors.
