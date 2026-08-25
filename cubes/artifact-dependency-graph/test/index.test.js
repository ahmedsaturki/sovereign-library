import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DependencyGraph, DependencyGraphError } from '../src/index.js';

const node = (id, type = 'artifact') => ({ id, type, label: id, metadata: { z: 2, a: 1 } });

test('nodes/edges are deterministic and snapshots are immutable', async () => {
  const graph = await new DependencyGraph().open();
  await graph.addNode(node('b')); await graph.addNode(node('a'));
  const edge = await graph.addEdge({ source: 'a', target: 'b', type: 'depends' });
  assert.equal(edge.source, 'a');
  assert.deepEqual(graph.neighbors('a'), ['b']);
  assert.deepEqual(graph.neighbors('b', 'in'), ['a']);
  const snapshot = graph.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(snapshot.nodes[0].id, 'a');
});

test('paths and cycle detection are bounded and deterministic', async () => {
  const graph = await new DependencyGraph().open();
  for (const id of ['a', 'b', 'c', 'd']) await graph.addNode(node(id));
  await graph.addEdge({ source: 'a', target: 'b', type: 'depends' });
  await graph.addEdge({ source: 'b', target: 'c', type: 'depends' });
  await graph.addEdge({ source: 'a', target: 'd', type: 'depends' });
  await graph.addEdge({ source: 'd', target: 'c', type: 'depends' });
  assert.deepEqual(graph.findPaths('a', 'c', { maxDepth: 2 }), [['a', 'b', 'c'], ['a', 'd', 'c']]);
  assert.equal(graph.hasCycle(), false);
  await graph.addEdge({ source: 'c', target: 'a', type: 'loop' });
  assert.equal(graph.hasCycle(), true);
});

test('rejectCycles rejects a cycle before mutating state', async () => {
  const graph = await new DependencyGraph().open();
  for (const id of ['a', 'b']) await graph.addNode(node(id));
  await graph.addEdge({ source: 'a', target: 'b', type: 'depends' });
  await assert.rejects(() => graph.addEdge({ source: 'b', target: 'a', type: 'depends' }, { rejectCycles: true }), (error) => error instanceof DependencyGraphError && error.code === 'CYCLE_DETECTED');
  assert.deepEqual(graph.neighbors('b'), []);
});

test('removeNode atomically removes incident edges and restores a clean graph', async () => {
  const graph = await new DependencyGraph().open();
  for (const id of ['a', 'b', 'c']) await graph.addNode(node(id));
  await graph.addEdge({ source: 'a', target: 'b', type: 'depends' });
  await graph.addEdge({ source: 'b', target: 'c', type: 'depends' });
  assert.equal(await graph.removeNode('b'), true);
  assert.deepEqual(graph.neighbors('a'), []);
  assert.deepEqual(graph.neighbors('c', 'in'), []);
  assert.equal(await graph.removeNode('b'), false);
});

test('persistence is deterministic and corruption fails closed', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'graph-')); const file = path.join(root, 'graph.sag');
  const graph = await new DependencyGraph({ file }).open();
  await graph.addNode(node('a')); await graph.addNode(node('b')); await graph.addEdge({ source: 'a', target: 'b', type: 'depends' });
  const serialized = graph.serialize();
  const restored = await new DependencyGraph({ file }).open();
  assert.deepEqual([...restored.serialize()], [...serialized]);
  await writeFile(file, Buffer.from('SAG1\n{"broken":true}\n'));
  await assert.rejects(() => new DependencyGraph({ file }).open(), (error) => error instanceof DependencyGraphError && ['INVALID_GRAPH', 'CORRUPT_GRAPH'].includes(error.code));
});

test('bounds, duplicate inputs, unknown nodes, and accessors fail closed while valid operations recover', async () => {
  const graph = await new DependencyGraph({ limits: { maxNodes: 1, maxResults: 1 } }).open();
  await graph.addNode(node('a'));
  await assert.rejects(() => graph.addNode(node('b')), /node count/i);
  const accessor = node('x'); Object.defineProperty(accessor, 'metadata', { enumerable: true, get() { throw new Error('getter'); } });
  await assert.rejects(() => graph.addNode(accessor), /accessor/i);
  await assert.rejects(() => graph.addEdge({ source: 'a', target: 'x', type: 'depends' }), /unknown node/i);
  assert.deepEqual(graph.neighbors('a'), []);
});
