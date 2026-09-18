// Generate DIG1 digest conformance vectors GROUNDED IN REAL Node execution.
// Hex outputs are used so vectors round-trip through JSON cleanly (Node Buffer -> hex string).
// Run: node scripts/gen-digest-vectors.mjs
// Emits contracts/conformance/vectors.digest.json
import fs from 'node:fs';
import path from 'node:path';
import { digestHex, hmacHex, constantTimeEqual, createDigestConfig, DigestError, DEFAULT_MAX_INPUT_BYTES } from '../cubes/digest/src/index.js';

const vectors = [];
function add(id, call, expect) { vectors.push({ id, call, expect }); }

const msg = 'The quick brown fox jumps over the lazy dog';
add('sha256-hex', ['digestHex', ['sha256', msg]], { kind: 'value', value: digestHex('sha256', msg) });
add('sha512-hex', ['digestHex', ['sha512', msg]], { kind: 'value', value: digestHex('sha512', msg) });
add('hmacSha256-hex', ['hmacHex', ['sha256', 'secret', msg]], { kind: 'value', value: hmacHex('sha256', 'secret', msg) });
add('hmacSha512-hex', ['hmacHex', ['sha512', 'secret', msg]], { kind: 'value', value: hmacHex('sha512', 'secret', msg) });

const empty = '';
add('sha256-empty', ['digestHex', ['sha256', empty]], { kind: 'value', value: digestHex('sha256', empty) });

// algorithm normalization (sha-256 -> sha256)
add('sha256-dash-normalization', ['digestHex', ['sha-256', msg]], { kind: 'value', value: digestHex('sha256', msg) });
add('sha256-upper-normalization', ['digestHex', ['SHA256', msg]], { kind: 'value', value: digestHex('sha256', msg) });

// constant time equal (bytes cannot round-trip JSON, so use $build:bytes directives)
add('cte-equal', ['constantTimeEqual', [{ "$build": "bytes", "value": "abc" }, { "$build": "bytes", "value": "abc" }]], { kind: 'value', value: true });
add('cte-different', ['constantTimeEqual', [{ "$build": "bytes", "value": "abc" }, { "$build": "bytes", "value": "abd" }]], { kind: 'value', value: false });
add('cte-length-mismatch', ['constantTimeEqual', [{ "$build": "bytes", "value": "ab" }, { "$build": "bytes", "value": "abc" }]], { kind: 'value', value: false });

// config
add('config-default', ['createDigestConfig', []], { kind: 'value', value: { maxInputBytes: DEFAULT_MAX_INPUT_BYTES, maxChunkBytes: 1024 * 1024, maxTotalBytes: 256 * 1024 * 1024 } });

// throws
add('throws-unsupported-algorithm', ['digestHex', ['md5', msg]], { kind: 'throws', errorName: 'DigestError' });
add('throws-invalid-input', ['digestHex', ['sha256', 123]], { kind: 'throws', errorName: 'DigestError' });
add('throws-invalid-options', ['digestHex', ['sha256', msg, null]], { kind: 'throws', errorName: 'DigestError' });
add('throws-input-too-large', ['digestHex', ['sha256', 'x'.repeat(10), { maxInputBytes: 5 }]], { kind: 'throws', errorName: 'DigestError' });
add('cte-invalid-type', ['constantTimeEqual', ['abc', 'abc']], { kind: 'throws', errorName: 'DigestError' });

const doc = {
  contract: 'digest',
  format: 'DIG1',
  version: '0.1.0',
  package: '@sovereign/digest',
  derivedFrom: 'cubes/digest/src/index.js (canonical Node implementation)',
  derivedAt: '2026-08-28',
  notes: 'Canonical vectors grounded in real Node execution. Hex outputs used for JSON-safe round-trip. A native port MUST satisfy every vector exactly.',
  vectors,
};
const out = path.resolve('contracts/conformance/vectors.digest.json');
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`wrote ${out} (${vectors.length} vectors)`);
