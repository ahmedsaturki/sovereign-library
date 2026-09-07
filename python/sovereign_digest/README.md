# sovereign-digest (Python)

Native Python implementation of the **DIG1** digest contract from Sovereign Library.

- **Dependency-free**: standard library only (`hashlib`, `hmac`).
- **Independent**: usable outside the monorepo. No Node runtime required.
- **Contract-conformant**: satisfies `contracts/conformance/vectors.digest.json`
  (the same canonical vectors the Node cube satisfies).

Deterministic hashing/HMAC (SHA-256/512), constant-time byte comparison, and streamed
async hashing. This is a **native** implementation — it does not wrap the Node cube.

## Use

```python
from sovereign_digest import sha256, hmacSha256, digestHex, constantTimeEqual

digestHex("sha256", "hello")                         # hex string
constantTimeEqual(b"a", b"a")                        # True
```

## Verify

```bash
python python/scripts/run_conformance.py \
  contracts/conformance/vectors.digest.json \
  src/sovereign_digest/__init__.py

python -m pytest tests -q
```

Distribution policy: GitHub canonical. PyPI publication is optional and separate.
