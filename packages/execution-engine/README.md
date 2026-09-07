# Execution Engine Cube

Deterministic local task execution for bounded dependency graphs.

## Example

```js
import { createExecutionEngine } from './src/index.js';

const engine = createExecutionEngine({
  tasks: [
    { id: 'prepare', run: async () => 'ready' },
    { id: 'build', dependsOn: ['prepare'], run: async ({ results }) => `${results.prepare}-build` },
  ],
});

console.log(await engine.run());
```

The cube owns execution only. Scheduling services, queues, remote workers, networks, and browser automation are out of scope.

## Safety

Definitions, inputs, results, and snapshots are copied/frozen at the API boundary. Cycles, duplicate ids, malformed tasks, unsupported values, excessive payloads, and excessive execution depth fail closed with typed `ExecutionError` diagnostics.
