# Process Supervisor / Managed Child Lifecycle v0.1

A native Node.js supervisor for one bounded managed child process per supervisor instance.

## Guarantees

- Explicit lifecycle state machine.
- No shell execution is introduced by the supervisor.
- Graceful stop followed by bounded forced escalation.
- Restart is opt-in and bounded.
- Stale child-generation events are ignored.
- Health inspection is read-only.
- Output and diagnostics are bounded.
- Abort/deadline controls are explicit.
- Runtime has zero third-party dependencies.

## Example

```js
import { createProcessSupervisor } from './src/index.js';

const supervisor = createProcessSupervisor({
  command: process.execPath,
  args: ['-e', 'setInterval(() => {}, 1000)'],
  stopGracePeriodMs: 250,
  maxRestartAttempts: 2,
});

await supervisor.start();
console.log(supervisor.inspect());

await supervisor.stop();
await supervisor.close();
```

`inspect()` never starts, stops, or restarts the child.

## Scope boundary

This cube does not manage descendant process trees, OS service managers, distributed leadership, persistence, cross-host supervision, shell composition, or hidden health remediation.
