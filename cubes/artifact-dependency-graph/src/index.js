import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAGIC = 'SAG1';
const DEFAULT_LIMITS = Object.freeze({ maxNodes: 4096, maxEdges: 16384, maxIdBytes: 256, maxTypeBytes: 128, maxLabelBytes: 512, maxMetadataBytes: 16 * 1024, maxDepth: 32, maxResults: 1024, maxSerializedBytes: 8 * 1024 * 1024 });
class DependencyGraphError extends Error { constructor(code, message) { super(message); this.name = 'DependencyGraphError'; this.code = code; Object.freeze(this); } }
const fail = (code, message) => { throw new DependencyGraphError(code, message); };
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const bytes = (value) => Buffer.byteLength(value, 'utf8');
const hash = (value) => createHash('sha256').update(value).digest('hex');

function rejectAccessors(value, label) {
  if (!isRecord(value)) fail('INVALID_DEFINITION', `${label} must be an object`);
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key === 'symbol' || !d || !('value' in d)) fail('INVALID_DEFINITION', `${label} contains accessor or symbol key`);
  }
}
function stable(value, label = 'value') {
  if (Array.isArray(value)) return value.map((item, i) => stable(item, `${label}[${i}]`));
  if (isRecord(value)) { rejectAccessors(value, label); const out = {}; for (const key of Object.getOwnPropertyNames(value).sort()) out[key] = stable(value[key], `${label}.${key}`); return out; }
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  fail('UNSUPPORTED_VALUE', `${label} contains unsupported value`);
}
function limitsOf(input = {}) { rejectAccessors(input, 'limits'); const out = { ...DEFAULT_LIMITS, ...input }; for (const v of Object.values(out)) if (!Number.isSafeInteger(v) || v < 1) fail('INVALID_LIMIT', 'Invalid graph limit'); return Object.freeze(out); }
function text(value, label, max) { if (typeof value !== 'string' || !value) fail('INVALID_FIELD', `${label} must be non-empty string`); if (bytes(value) > max) fail('LIMIT_EXCEEDED', `${label} exceeds limit`); return value; }
function normalizeNode(input, limits) {
  rejectAccessors(input, 'node');
  const id = text(input.id, 'id', limits.maxIdBytes);
  const type = text(input.type, 'type', limits.maxTypeBytes);
  const label = input.label === undefined ? id : text(input.label, 'label', limits.maxLabelBytes);
  const metadata = stable(input.metadata ?? {}, 'metadata');
  if (bytes(JSON.stringify(metadata)) > limits.maxMetadataBytes) fail('LIMIT_EXCEEDED', 'metadata exceeds limit');
  return Object.freeze({ id, type, label, metadata });
}
function edgeId(source, type, target) { return hash(`${source}\0${type}\0${target}`); }
function normalizeEdge(input, limits) {
  rejectAccessors(input, 'edge');
  const source = text(input.source, 'source', limits.maxIdBytes); const target = text(input.target, 'target', limits.maxIdBytes); const type = text(input.type, 'type', limits.maxTypeBytes);
  return Object.freeze({ id: edgeId(source, type, target), source, target, type });
}
function canonicalGraph(nodes, edges, limits) {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) fail('INVALID_GRAPH', 'nodes/edges must be arrays');
  if (nodes.length > limits.maxNodes || edges.length > limits.maxEdges) fail('LIMIT_EXCEEDED', 'graph size exceeds limit');
  const nodeList = nodes.map((n) => normalizeNode(n, limits)).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const nodeIds = new Set(); for (const n of nodeList) { if (nodeIds.has(n.id)) fail('DUPLICATE_NODE', `duplicate node: ${n.id}`); nodeIds.add(n.id); }
  const edgeList = edges.map((e) => normalizeEdge(e, limits)).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const edgeIds = new Set(); for (const e of edgeList) { if (edgeIds.has(e.id)) fail('DUPLICATE_EDGE', `duplicate edge: ${e.id}`); if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) fail('UNKNOWN_NODE', 'edge references unknown node'); edgeIds.add(e.id); }
  return { nodes: Object.freeze(nodeList), edges: Object.freeze(edgeList) };
}
function serializeGraph(nodes, edges, limits) {
  const canonical = canonicalGraph(nodes, edges, limits);
  const payload = JSON.stringify({ format: MAGIC, version: 1, ...canonical });
  if (bytes(payload) > limits.maxSerializedBytes) fail('LIMIT_EXCEEDED', 'graph exceeds serialized limit');
  const checksum = hash(payload); return Buffer.from(`${MAGIC}\n${JSON.stringify({ format: MAGIC, version: 1, ...canonical, checksum })}\n`, 'utf8');
}
function parseGraph(raw, limits) {
  if (!(raw instanceof Uint8Array)) fail('UNSUPPORTED_VALUE', 'graph bytes required');
  if (raw.byteLength > limits.maxSerializedBytes) fail('LIMIT_EXCEEDED', 'graph exceeds serialized limit');
  const textValue = Buffer.from(raw).toString('utf8'); if (!textValue.startsWith(`${MAGIC}\n`)) fail('INVALID_GRAPH', 'invalid graph header');
  let parsed; try { parsed = JSON.parse(textValue.slice(MAGIC.length + 1).trimEnd()); } catch { fail('INVALID_GRAPH', 'malformed graph'); }
  rejectAccessors(parsed, 'graph');
  if (parsed.format !== MAGIC || parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || typeof parsed.checksum !== 'string') fail('INVALID_GRAPH', 'unsupported graph format');
  const canonical = canonicalGraph(parsed.nodes, parsed.edges, limits); const payload = JSON.stringify({ format: MAGIC, version: 1, ...canonical }); if (parsed.checksum !== hash(payload)) fail('CORRUPT_GRAPH', 'graph checksum mismatch');
  return canonical;
}

class DependencyGraph {
  constructor(options = {}) { rejectAccessors(options, 'options'); this.limits = limitsOf(options.limits ?? {}); this.file = options.file ? path.resolve(options.file) : null; this.nodes = new Map(); this.edges = new Map(); this.closed = false; }
  _assertOpen() { if (this.closed) fail('CLOSED', 'graph is closed'); }
  _snapshot() { return canonicalGraph([...this.nodes.values()], [...this.edges.values()], this.limits); }
  async open() { this._assertOpen(); if (this.file) { try { const g = parseGraph(await fs.readFile(this.file), this.limits); this.nodes = new Map(g.nodes.map((n) => [n.id, n])); this.edges = new Map(g.edges.map((e) => [e.id, e])); } catch (error) { if (error?.code !== 'ENOENT') throw error; } } return this; }
  close() { this.closed = true; }
  async _persist(nodes, edges) { if (!this.file) return; await fs.mkdir(path.dirname(this.file), { recursive: true }); const data = serializeGraph(nodes, edges, this.limits); const temp = `${this.file}.${process.pid}.${Date.now()}.tmp`; await fs.writeFile(temp, data, { flag: 'wx' }); try { await fs.rename(temp, this.file); } catch (error) { try { await fs.unlink(temp); } catch {} throw error; } }
  async addNode(input) { this._assertOpen(); const node = normalizeNode(input, this.limits); if (this.nodes.has(node.id)) fail('DUPLICATE_NODE', `duplicate node: ${node.id}`); const next = new Map(this.nodes); next.set(node.id, node); if (next.size > this.limits.maxNodes) fail('LIMIT_EXCEEDED', 'node count exceeds limit'); await this._persist([...next.values()], [...this.edges.values()]); this.nodes = next; return node; }
  async removeNode(id) { this._assertOpen(); const key = text(id, 'id', this.limits.maxIdBytes); if (!this.nodes.has(key)) return false; const nodes = new Map(this.nodes); nodes.delete(key); const edges = new Map([...this.edges].filter(([, e]) => e.source !== key && e.target !== key)); await this._persist([...nodes.values()], [...edges.values()]); this.nodes = nodes; this.edges = edges; return true; }
  async addEdge(input, options = {}) { this._assertOpen(); rejectAccessors(options, 'options'); const edge = normalizeEdge(input, this.limits); if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) fail('UNKNOWN_NODE', 'edge references unknown node'); if (this.edges.has(edge.id)) fail('DUPLICATE_EDGE', `duplicate edge: ${edge.id}`); const edges = new Map(this.edges); edges.set(edge.id, edge); if (edges.size > this.limits.maxEdges) fail('LIMIT_EXCEEDED', 'edge count exceeds limit'); const wouldCycle = this._detectCycle([...this.nodes.values()], [...edges.values()]); if (options.rejectCycles && wouldCycle) fail('CYCLE_DETECTED', 'edge would create a cycle'); await this._persist([...this.nodes.values()], [...edges.values()]); this.edges = edges; return Object.freeze({ ...edge, cycle: wouldCycle }); }
  async removeEdge(id) { this._assertOpen(); const key = text(id, 'edge id', 128); if (!this.edges.has(key)) return false; const edges = new Map(this.edges); edges.delete(key); await this._persist([...this.nodes.values()], [...edges.values()]); this.edges = edges; return true; }
  _adjacency(outgoing) { const map = new Map(); for (const node of this.nodes.keys()) map.set(node, []); for (const e of this.edges.values()) map.get(outgoing ? e.source : e.target).push(outgoing ? e.target : e.source); for (const list of map.values()) list.sort((a, b) => a.localeCompare(b, 'en')); return map; }
  neighbors(id, direction = 'out') { this._assertOpen(); const key = text(id, 'id', this.limits.maxIdBytes); if (!this.nodes.has(key)) fail('UNKNOWN_NODE', `unknown node: ${key}`); if (!['out', 'in'].includes(direction)) fail('INVALID_FIELD', 'direction must be out or in'); return Object.freeze((this._adjacency(direction === 'out').get(key) ?? []).slice(0, this.limits.maxResults)); }
  findPaths(from, to, options = {}) { this._assertOpen(); rejectAccessors(options, 'options'); const start = text(from, 'from', this.limits.maxIdBytes); const goal = text(to, 'to', this.limits.maxIdBytes); if (!this.nodes.has(start) || !this.nodes.has(goal)) fail('UNKNOWN_NODE', 'path references unknown node'); const maxDepth = options.maxDepth === undefined ? this.limits.maxDepth : Math.min(options.maxDepth, this.limits.maxDepth); const maxResults = options.limit === undefined ? this.limits.maxResults : Math.min(options.limit, this.limits.maxResults); if (!Number.isSafeInteger(maxDepth) || maxDepth < 0 || !Number.isSafeInteger(maxResults) || maxResults < 1) fail('INVALID_LIMIT', 'invalid path limits'); const adjacency = this._adjacency(true); const paths = []; const walk = (current, pathList, seen) => { if (paths.length >= maxResults || pathList.length - 1 > maxDepth) return; if (current === goal) { paths.push(Object.freeze(pathList.slice())); return; } for (const next of adjacency.get(current) ?? []) { if (seen.has(next)) continue; const nextSeen = new Set(seen); nextSeen.add(next); walk(next, [...pathList, next], nextSeen); } }; walk(start, [start], new Set([start])); return Object.freeze(paths); }
  hasCycle() { this._assertOpen(); return this._detectCycle([...this.nodes.values()], [...this.edges.values()]); }
  _detectCycle(nodes, edges) { const adjacency = new Map(nodes.map((n) => [n.id, []])); for (const e of edges) adjacency.get(e.source).push(e.target); for (const v of adjacency.values()) v.sort(); const visiting = new Set(); const visited = new Set(); const dfs = (node) => { if (visiting.has(node)) return true; if (visited.has(node)) return false; visiting.add(node); for (const next of adjacency.get(node) ?? []) if (dfs(next)) return true; visiting.delete(node); visited.add(node); return false; }; for (const node of [...adjacency.keys()].sort()) if (dfs(node)) return true; return false; }
  snapshot() { this._assertOpen(); const graph = this._snapshot(); return Object.freeze({ format: MAGIC, version: 1, nodes: graph.nodes, edges: graph.edges }); }
  serialize() { this._assertOpen(); return serializeGraph([...this.nodes.values()], [...this.edges.values()], this.limits); }
  restore(serialized) { this._assertOpen(); const graph = parseGraph(serialized, this.limits); this.nodes = new Map(graph.nodes.map((n) => [n.id, n])); this.edges = new Map(graph.edges.map((e) => [e.id, e])); }
}

export { MAGIC, DEFAULT_LIMITS, DependencyGraphError, DependencyGraph, serializeGraph, parseGraph };
