import { createWorkflowEngine } from '../cubes/workflow-durable/src/index.js';

const engine = createWorkflowEngine();
const workflow = engine.define({
  id: 'demo',
  version: '1',
  steps: [
    { id: 'greet', kind: 'task', run: ({ input }) => `hello ${input.name}` },
    { id: 'parallel', kind: 'parallel', steps: [
      { id: 'a', kind: 'task', run: () => 'A' },
      { id: 'b', kind: 'task', run: () => 'B' },
    ] },
  ],
});

const execution = engine.start(workflow, { name: 'Sovereign' });
console.log(await execution.run());