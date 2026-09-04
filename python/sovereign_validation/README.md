# sovereign-validation (Python)

Native Python implementation of the **VAL1** validation contract from Sovereign Library.

- **Dependency-free**: standard library only.
- **Independent**: usable outside the monorepo. No Node runtime required.
- **Contract-conformant**: matches the Node `@sovereign/validation` behavior (verified by native pytest).

Declarative schema validation with `parse` (throws on failure), `safeParse` (returns
`{success, data, issues}`), and `validators` (string/number/integer/boolean/array/object/literal).
Supports type/enum/literal checks, string length + pattern, numeric min/max, array
min/max items, object shape, and `unknownKeys` policy (`error`/`strip`/`preserve`).
This is a **native** implementation — it does not wrap the Node cube.

## Use

```python
from sovereign_validation import schema

s = schema({"type": "object", "shape": {"name": {"type": "string", "minLength": 1}, "age": {"type": "integer", "min": 0}}})
s.parse({"name": "Ada", "age": 36})            # {"name": "Ada", "age": 36}
s.safeParse({"name": "", "age": -1})           # success=False with issues
```

## Verify

```bash
python -m pytest tests -q
```

Distribution policy: GitHub canonical. PyPI publication is optional and separate.
