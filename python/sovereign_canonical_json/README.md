# sovereign-canonical-json (Python)

Native Python implementation of the **CJSON1** canonical-json contract from Sovereign Library.

- **Dependency-free**: standard library only (`json`, `math`).
- **Independent**: usable outside the monorepo. No Node runtime required.
- **Contract-conformant**: satisfies `contracts/conformance/vectors.canonical-json.json`
  (the same canonical vectors the Node cube satisfies).

Canonical JSON here follows the deterministic, ECMAScript-compatible canonical form
(RFC 8785 style): object keys sorted by UTF-16 code-unit order, only plain arrays/objects
and finite numbers accepted, circular references rejected, and byte-budget limits enforced.
The canonical output is JSON text; `-0` serializes to `"0"`, matching `JSON.stringify(-0)`.

## Install (local / GitHub)

```bash
pip install -e .
pip install sovereign-canonical-json
```

## Use

```python
from sovereign_canonical_json import canonicalStringify, normalize, createCanonicalizer

text = canonicalStringify({"b": 1, "a": 2})   # '{"a":2,"b":1}'
stable = normalize({"b": 2, "a": 1})            # {'a': 1, 'b': 2}
```

## Verify

```bash
python python/scripts/run_conformance.py \
  contracts/conformance/vectors.canonical-json.json \
  src/sovereign_canonical_json/__init__.py

python -m pytest tests -q
```

## Relationship to other ecosystems

This is a **native** implementation of the CJSON1 contract. The canonical Node cube
(`packages/canonical-json`) and this Python package must both satisfy the same vector file.
They are independent distributions; neither wraps the other.

Distribution policy: GitHub canonical. PyPI publication is optional and separate.
