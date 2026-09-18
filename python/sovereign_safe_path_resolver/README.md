# sovereign-safe-path-resolver (Python)

Native Python implementation of the **SPR1** safe-path-resolver contract from Sovereign Library.

- **Dependency-free**: standard library only (`hashlib`, `re`, `json`, `math`).
- **Independent**: usable outside the monorepo. No Node runtime required.
- **Contract-conformant**: satisfies `contracts/conformance/vectors.safe-path-resolver.json`
  (the same canonical vectors the Node cube satisfies).

## Install (local / GitHub)

```bash
pip install -e .
# or, from a built sdist/wheel
pip install sovereign-safe-path-resolver
```

## Use

```python
from sovereign_safe_path_resolver import resolveContained, isContained, normalizePath

resolveContained("/a", "b/c")            # "/a/b/c"
isContained("/a/b/c", "/a")              # {"status": "contained", ...}
normalizePath("a/./b/../c")              # "a/c"
resolveContained("/a", "../etc/passwd")  # raises SafePathResolverError (TRAVERSAL_ESCAPE)
```

## Verify

```bash
python python/scripts/run_conformance.py \
  contracts/conformance/vectors.safe-path-resolver.json \
  src/sovereign_safe_path_resolver/__init__.py

python -m pytest tests -q
```

## Relationship to other ecosystems

This is a **native** implementation of the SPR1 contract. The canonical Node cube
(`packages/safe-path-resolver`) and this Python package must both satisfy the same
vector file. They are independent distributions; neither wraps the other.

Distribution policy: GitHub canonical. PyPI publication is an optional, separate
release decision and is not performed automatically.
