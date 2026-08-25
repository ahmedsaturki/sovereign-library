import { DependencyGraph } from '../cubes/artifact-dependency-graph/src/index.js';

const graph = await new DependencyGraph({ file: './graph.sag' }).open();
await graph.addNode({ id: 'app', type: 'package' });
await graph.addNode({ id: 'lib', type: 'package' });
await graph.addEdge({ source: 'app', target: 'lib', type: 'depends' });

console.log('neighbors:', graph.neighbors('app'));
console.log('paths:', graph.findPaths('app', 'lib'));
