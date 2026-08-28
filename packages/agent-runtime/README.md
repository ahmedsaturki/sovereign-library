# Agent Runtime Cube

Standalone local agent session runtime for deterministic, bounded tool-aware execution.

## Contract

The cube owns agent definition validation, deterministic session/turn state, bounded message/output/tool work, capability allowlisting, cancellation/timeout/retry semantics, and immutable snapshots.

Tool handlers are supplied by the caller. The runtime does not perform network discovery, load provider SDKs, or execute arbitrary shell commands.

## Example

```js
import { createAgentRuntime } from './src/index.js';

const runtime = createAgentRuntime({
  definition: {
    id: 'demo-agent',
    version: '1',
    tools: [{
      name: 'echo',
      handler: async input => ({ echoed: input }),
    }],
  },
});

const session = runtime.createSession({ id: 'demo' });
const result = await session.runTurn('hello', {
  execute: async ({ messages }, { invokeTool }) => {
    const tool = await invokeTool({ name: 'echo', input: { text: messages.at(-1).content } });
    return { output: JSON.stringify(tool.result) };
  },
});

console.log(result.state, result.output);
```

## Safety and bounds

The runtime rejects accessor properties, circular values, unbounded message/tool/output work, unknown tools, and invalid state transitions. Errors are typed and do not copy arbitrary prompt/tool payloads into diagnostics.
