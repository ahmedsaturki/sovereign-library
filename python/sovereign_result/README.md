# sovereign-result (Python)

Native Python implementation of the **RES1** result contract from Sovereign Library.

- **Dependency-free**: standard library only.
- **Independent**: usable outside the monorepo. No Node runtime required.
- **Contract-conformant**: satisfies `contracts/conformance/vectors.result.json`
  (the same canonical vectors the Node cube satisfies).

A Result is a frozen tagged object. Success carries `value`; failure carries `error`
(a `ResultError` with `code`, `retryable`, `cancelled`, `timedOut`, `details`, `cause`).
Snapshots are fail-closed (immutable) so untrusted data cannot mutate a Result after construction.

## Install (local / GitHub)

```bash
pip install -e .
pip install sovereign-result
```

## Use

```python
from sovereign_result import Result, errors

r = Result.fromThrowable(lambda: 1 / 0)
Result.is_(r)            # True
r["ok"]                  # False
r["error"].code         # 'UNKNOWN_ERROR'

ok = Result.ok(42)
Result.map(ok, lambda x: x * 2)   # {'__sov_result__': True, 'ok': True, 'value': 84}
```

## Verify

```bash
python python/scripts/run_conformance.py \
  contracts/conformance/vectors.result.json \
  src/sovereign_result/__init__.py

python -m pytest tests -q
```

## Relationship to other ecosystems

This is a **native** implementation of the RES1 contract. The canonical Node cube
(`packages/result`) and this Python package must both satisfy the same vector file.
They are independent distributions; neither wraps the other.

Distribution policy: GitHub canonical. PyPI publication is optional and separate.
