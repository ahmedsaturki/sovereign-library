# Artifact Dependency Graph / Relationship Index v0.1

Standalone deterministic local directed relationship graph for artifact/package nodes and typed edges.

## Example

```js
import { DependencyGraph } from './src/index.js';

const graph = await new DependencyGraph({ file: './graph.sag' }).open();
await graph.addNode({ id: 'app', type: 'package', label: 'app' });
await graph.addNode({ id: 'lib', type: 'package', label: 'lib' });
await graph.addEdge({ source: 'app', target: 'lib', type: 'depends' });

console.log(graph.neighbors('app'));
console.log(graph.findPaths('app', 'lib'));
```

## Contract

The graph uses stable node ids and SHA-256-derived edge identifiers. Nodes and edges are sorted canonically for snapshots and the `SAG1` serialized form. Queries are bounded and deterministic. Optional cycle rejection prevents a mutating operation from committing a cyclic graph.

Persistence uses checksum-protected canonical state and atomic replacement. Restore never executes code or performs external resolution.

Runtime dependencies: none.
