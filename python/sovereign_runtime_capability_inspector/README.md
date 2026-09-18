# sovereign-runtime-capability-inspector (Python)

Native Python implementation of the **RCI1** runtime-capability-inspector contract from Sovereign Library.

- **Dependency-free**: standard library only (`os`, `platform`, `sys`, `re`, `json`, `shutil`).
- **Independent**: usable outside the monorepo. No Node runtime required.
- **Contract-conformant**: satisfies `contracts/conformance/vectors.runtime-capability-inspector.json`
  (the same canonical vectors the Node cube satisfies).

## Install (local / GitHub)

```bash
pip install -e .
pip install sovereign-runtime-capability-inspector
```

## Use

```python
from sovereign_runtime_capability_inspector import inspectRuntime, evaluateRuntimeRequirements

snapshot = inspectRuntime({"env": {"PATH": "/usr/bin:/bin"}})
verdict = evaluateRuntimeRequirements(snapshot, {"os": [snapshot["platform"]["os"]]})
verdict["passed"]  # True
```

## Verify

```bash
python python/scripts/run_conformance.py \
  contracts/conformance/vectors.runtime-capability-inspector.json \
  src/sovereign_runtime_capability_inspector/__init__.py

python -m pytest tests -q
```

## Relationship to other ecosystems

This is a **native** implementation of the RCI1 contract. The canonical Node cube
(`packages/runtime-capability-inspector`) and this Python package must both satisfy the
same vector file. They are independent distributions; neither wraps the other.

Distribution policy: GitHub canonical. PyPI publication is optional and separate.
