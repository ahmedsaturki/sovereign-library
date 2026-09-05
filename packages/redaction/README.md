# Redaction / Secret Safety Cube v0.1

A standalone fail-closed recursive data-redaction product for structured logs, diagnostics, configuration snapshots, HTTP payloads, and error reporting.

## Contract

- No runtime third-party dependencies.
- Built-in sensitive-key matching covers common credential-bearing key forms.
- Custom exact keys, regular-expression key rules, and a key matcher can extend detection.
- Built-in string rules redact Bearer credentials, Basic credentials, and PEM private-key blocks.
- Custom string regex rules are supported with deterministic replacement semantics.
- Plain objects and arrays are traversed recursively without mutating the source.
- Sensitive-key matches replace the complete value before traversal, preventing accidental leakage from nested secret structures.
- Input depth, node count, string size, and final output size are bounded.
- Circular references fail closed instead of being traversed unpredictably.
- Unsupported object/value types fail closed.
- `redactWithReport()` returns immutable output plus diagnostics containing paths/counts only; secret values are never copied into the report.
- Report paths and object keys are deterministically ordered.

## Example

```js
import { createRedactor } from './src/index.js';

const redactor = createRedactor({
  replacement: '[SECRET]'
});

const safe = redactor.redact({
  user: 'Ahmed',
  password: 'do-not-log',
  headers: { authorization: 'Bearer abc.def.ghi' }
});

console.log(safe);
```

## Product boundary

This cube protects data that is already inside the application. It intentionally does not store secrets, rotate credentials, encrypt data, call external DLP services, or enforce network policy.

The security rule is fail-closed: when the redactor cannot safely represent the input within its configured contract, it throws a typed `RedactionError` rather than returning potentially unsafe data.
