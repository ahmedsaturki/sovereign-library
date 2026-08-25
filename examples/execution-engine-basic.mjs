import { createExecutionEngine } from '../cubes/execution-engine/src/index.js';

const engine = createExecutionEngine({
  tasks: [
    { id: 'prepare', run: async () => 'ready' },
    { id: 'build', dependsOn: ['prepare'], run: async ({ results }) => `${results.prepare}:build` },
  ],
});

console.log(await engine.run());
