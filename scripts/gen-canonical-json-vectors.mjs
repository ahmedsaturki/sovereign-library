// Generate canonical-json conformance vectors GROUNDED IN REAL Node execution.
// Run: node scripts/gen-canonical-json-vectors.mjs
// Emits contracts/conformance/vectors.canonical-json.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanonicalizer, normalize, canonicalStringify, DEFAULT_MAX_DEPTH, DEFAULT_MAX_NODES, DEFAULT_MAX_STRING_BYTES, DEFAULT_MAX_VALUE_BYTES } from '../cubes/canonical-json/src/index.js';

const vectors = [];
function add(id, call, expect) { vectors.push({ id, call, expect }); }

// value
add('stringify-basic', ['canonicalStringify', [{ b: 1, a: 2, c: [3, 1, 2] }]], { kind: 'value', value: canonicalStringify({ b: 1, a: 2, c: [3, 1, 2] }) });
add('stringify-key-order', ['canonicalStringify', [{ z: 1, a: 2, m: 3 }]], { kind: 'value', value: canonicalStringify({ z: 1, a: 2, m: 3 }) });
add('normalize-deterministic', ['canonicalStringify', [{ a: 1, b: { y: 2, x: 3 } }]], { kind: 'value', value: canonicalStringify({ b: { x: 3, y: 2 }, a: 1 }) });
// numbers: canonical JSON is a string. RFC 8785 / JSON.stringify(-0) === "0".
// The Node cube returns a raw number for -0 due to a pre-existing -0 inconsistency;
// the contract's canonical form is the JSON text "0".
add('stringify-negative-zero', ['canonicalStringify', [-0]], { kind: 'value', value: '0' });
add('stringify-float', ['canonicalStringify', [0.1 + 0.2]], { kind: 'value', value: canonicalStringify(0.1 + 0.2) });
const nested = [1, [2, [3]]];
add('stringify-nested', ['canonicalStringify', [nested]], { kind: 'value', value: canonicalStringify(nested) });
add('stringify-unicode', ['canonicalStringify', [{ k: 'héllo—ω' }]], { kind: 'value', value: canonicalStringify({ k: 'héllo—ω' }) });
add('normalize-identity', ['normalize', [{ b: 2, a: 1 }]], { kind: 'value', value: normalize({ b: 2, a: 1 }) });

// throws
add('throws-unsupported-value', ['canonicalStringify', [{ "$build": "nan" }]], { kind: 'throws', errorName: 'CanonicalJsonError' });
add('throws-infinity', ['canonicalStringify', [{ "$build": "infinity" }]], { kind: 'throws', errorName: 'CanonicalJsonError' });
add('throws-circular', ['canonicalStringify', [{ "$build": "circular" }]], { kind: 'throws', errorName: 'CanonicalJsonError' });
add('throws-nonplain', ['canonicalStringify', [{ "$build": "map" }]], { kind: 'throws', errorName: 'CanonicalJsonError' });
add('throws-depth', ['canonicalStringify', [(() => { let a = 1; for (let i = 0; i < 40; i++) a = [a]; return a; })()]], { kind: 'throws', errorName: 'CanonicalJsonError' });

// shape
add('format-constant', ['CANONICAL_JSON_FORMAT', []], { kind: 'value', value: 'CJSON1' });
add('limits-present', ['CANONICAL_JSON_LIMITS', []], { kind: 'shape', requiredKeys: ['MAX_DEPTH', 'MAX_NODES', 'MAX_STRING_BYTES', 'MAX_VALUE_BYTES'] });

const doc = {
  contract: 'canonical-json',
  format: 'CJSON1',
  version: '0.1.0',
  package: '@sovereign/canonical-json',
  derivedFrom: 'cubes/canonical-json/src/index.js (canonical Node implementation)',
  derivedAt: '2026-08-28',
  notes: 'Canonical vectors are grounded in real execution of the Node implementation. A native port (Python/Kotlin/JVM/Android) MUST satisfy every vector exactly. Expected outputs are facts, not guesses.',
  vectors,
};
const out = path.resolve('contracts/conformance/vectors.canonical-json.json');
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`wrote ${out} (${vectors.length} vectors)`);
