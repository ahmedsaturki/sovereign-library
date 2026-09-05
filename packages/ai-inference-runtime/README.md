# AI / Inference Runtime Cube v0.1

Standalone provider-neutral local inference runtime. It normalizes ordered chat messages, enforces bounded request/output work, exposes immutable synchronous and streaming contracts, supports cancellation/timeouts, and can invoke a local inference executable through a native NDJSON stdio adapter without a shell.

```js
import { createRuntime } from './src/index.js';

const runtime = createRuntime({
  adapter: {
    async infer(request) {
      return { text: request.messages.at(-1).content.toUpperCase() };
    },
  },
});

const result = await runtime.infer({
  messages: [{ role: 'user', content: 'hello' }],
});
console.log(result.text);
```

## Guarantees

- deterministic message ordering
- immutable request/result/event snapshots
- bounded context, output, event, line, and diagnostic work
- explicit cancellation vs timeout semantics
- native child-process execution with `shell:false`
- bounded stdout/stderr handling
- typed fail-closed diagnostics
- zero runtime third-party dependencies

Model weights, network providers, SDK wrappers, agent planning, RAG, and UI/chat applications are out of scope for v0.1.
