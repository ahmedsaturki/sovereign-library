"""Native Python implementation of the VAL1 validation contract (Sovereign Library).

Dependency-free schema validation: `parse` / `safeParse` / `schema` / `validators`.
Pure logic; no OS facilities. Mirrors the Node `@sovereign/validation` contract.

This is a NATIVE implementation of the contract, not a wrapper around the Node cube.

Value-type mapping (contract is language-neutral):
- `string` -> str, `number` -> int|float (not bool), `integer` -> int (not bool),
  `boolean` -> bool, `bigint` -> int, `array` -> list, `object` -> dict (not None/list),
  `null` -> None, `any` -> anything.
Unknown-key policy: `error` (reject), `strip` (drop), `preserve` (keep, default).
"""

from __future__ import annotations

import re
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

__all__ = [
    "ValidationError",
    "Schema",
    "schema",
    "validators",
    "TYPES",
]

TYPES = {"string", "number", "integer", "boolean", "bigint", "object", "array", "null", "any"}

_INT_RE = re.compile(r"^-?\d+$")
_NUM_RE = re.compile(r"^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$")


def _object_is(a: Any, b: Any) -> bool:
    """Mirror JS Object.is for our value space, preserving int/float and bool/int distinction."""
    if type(a) is not type(b):
        return False
    try:
        return bool(a == b)
    except Exception:
        return False


def _freeze(value: Any, _seen: Optional[set] = None) -> Any:
    if _seen is None:
        _seen = set()
    if not isinstance(value, (dict, list)):
        return value
    ident = id(value)
    if ident in _seen:
        return value
    _seen.add(ident)
    if isinstance(value, list):
        return tuple(_freeze(v, _seen) for v in value)
    return _FrozenDict({k: _freeze(v, _seen) for k, v in value.items()})


class _FrozenDict(dict):
    def _immutable(self, *a, **k):
        raise TypeError("cannot mutate frozen snapshot")

    __setitem__ = _immutable
    __delitem__ = _immutable
    clear = _immutable
    pop = _immutable
    popitem = _immutable
    setdefault = _immutable
    update = _immutable


class ValidationError(Exception):
    """Raised by `Schema.parse` when validation fails. Issues are immutable (read-only)."""

    def __init__(self, issues: List[Any]) -> None:
        super().__init__(f"validation failed with {len(issues)} issue(s)")
        self.name = "ValidationError"
        self.code = "VALIDATION_FAILED"
        self._issues = tuple(_freeze(i) for i in issues)

    @property
    def issues(self) -> tuple:
        return self._issues

    def __setattr__(self, key: str, value: Any) -> None:
        if key == "_issues":
            return object.__setattr__(self, key, value)
        if getattr(self, "_frozen", False) and key not in ("_frozen", "__cause__", "__traceback__", "__context__", "__suppress_context__", "__notes__"):
            raise AttributeError(f"cannot mutate frozen error: {key}")
        object.__setattr__(self, key, value)


def _issue(path: str, code: str, message: str, **details: Any) -> Dict[str, Any]:
    return _FrozenDict({**{"path": path or "$", "code": code, "message": message}, **details})


def _path_join(path: str, key: str) -> str:
    return f"{path}[]" if key == "" else f"{path}.{key}"


def _coerce_value(value: Any, type_name: str) -> Any:
    if not isinstance(value, str):
        return value
    if type_name == "boolean":
        if value == "true" or value == "1":
            return True
        if value == "false" or value == "0":
            return False
    if type_name == "integer" and _INT_RE.match(value.strip()):
        return int(value.strip())
    if type_name == "number" and value.strip() != "" and _NUM_RE.match(value.strip()):
        return float(value.strip())
    if type_name == "bigint" and _INT_RE.match(value.strip()):
        return int(value.strip())
    return value


def _matches_type(value: Any, expected: str) -> bool:
    if expected == "any":
        return True
    if expected == "null":
        return value is None
    if expected == "array":
        return isinstance(value, list)
    if expected == "object":
        return value is not None and isinstance(value, dict) and not isinstance(value, list)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "bigint":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "string":
        return isinstance(value, str)
    return False


def _actual_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, list):
        return "array"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, str):
        return "string"
    return type(value).__name__


def _validate_node(schema: Dict[str, Any], value: Any, path: str, issues: List[Any], coerce: bool) -> Any:
    if value is _MISSING:
        if schema.get("required"):
            issues.append(_issue(path, "REQUIRED", "value is required"))
        elif "default" in schema:
            return schema["default"]
        return _MISSING

    current = _coerce_value(value, schema.get("type")) if coerce else value
    expected = schema.get("type")

    if expected and not _matches_type(current, expected):
        received = _actual_type(current)
        issues.append(_issue(path, "TYPE", f"expected {expected}, received {received}", expected=expected, received=received))
        return _MISSING

    if "literal" in schema and not _object_is(current, schema["literal"]):
        issues.append(_issue(path, "LITERAL", "value does not match literal", expected=schema["literal"]))
    if "enum" in schema and not any(_object_is(current, item) for item in schema["enum"]):
        issues.append(_issue(path, "ENUM", "value is not an allowed option", allowed=schema["enum"]))

    if expected == "string":
        if schema.get("minLength") is not None and len(current) < schema["minLength"]:
            issues.append(_issue(path, "MIN_LENGTH", f"string length must be >= {schema['minLength']}"))
        if schema.get("maxLength") is not None and len(current) > schema["maxLength"]:
            issues.append(_issue(path, "MAX_LENGTH", f"string length must be <= {schema['maxLength']}"))
        if schema.get("pattern") is not None and not re.search(schema["pattern"], current):
            issues.append(_issue(path, "PATTERN", "string does not match pattern"))

    if expected in ("number", "integer", "bigint"):
        if schema.get("min") is not None and current < schema["min"]:
            issues.append(_issue(path, "MIN", f"value must be >= {schema['min']}"))
        if schema.get("max") is not None and current > schema["max"]:
            issues.append(_issue(path, "MAX", f"value must be <= {schema['max']}"))

    if expected == "array":
        if schema.get("minItems") is not None and len(current) < schema["minItems"]:
            issues.append(_issue(path, "MIN_ITEMS", f"array length must be >= {schema['minItems']}"))
        if schema.get("maxItems") is not None and len(current) > schema["maxItems"]:
            issues.append(_issue(path, "MAX_ITEMS", f"array length must be <= {schema['maxItems']}"))
        if schema.get("items") is not None:
            out = []
            for index, item in enumerate(current):
                child = _validate_node(schema["items"], item, f"{path}[{index}]", issues, coerce)
                if child is not _MISSING:
                    out.append(child)
            current = out

    if expected == "object":
        shape = schema.get("shape") or {}
        out: Dict[str, Any] = {}
        for key, child_schema in shape.items():
            child = _validate_node(child_schema, current.get(key, _MISSING), _path_join(path, key), issues, coerce)
            if child is not _MISSING:
                out[key] = child
        unknown = [k for k in current.keys() if k not in shape]
        policy = schema.get("unknownKeys", "preserve")
        if policy not in ("error", "strip", "preserve"):
            issues.append(_issue(path, "INVALID_UNKNOWN_POLICY", "unknownKeys must be error, strip, or preserve"))
        elif unknown and policy == "error":
            for key in unknown:
                issues.append(_issue(_path_join(path, key), "UNKNOWN_KEY", "unknown key is not allowed"))
        if policy != "strip":
            for key in unknown:
                out[key] = current[key]
        current = out

    if callable(schema.get("validate")):
        result = schema["validate"](current, {"path": path})
        if result is not True and result is not None:
            message = result if isinstance(result, str) else "custom validation failed"
            issues.append(_issue(path, "CUSTOM", message))

    return current


class _Missing:
    pass


_MISSING = _Missing()


def _validate_definition(definition: Dict[str, Any]) -> None:
    if not isinstance(definition, dict) or isinstance(definition, list):
        raise TypeError("schema definition must be an object")
    if definition.get("type") is not None and definition["type"] not in TYPES:
        raise TypeError(f"unsupported validation type: {definition['type']}")
    if definition.get("type") == "array" and "items" in definition:
        items = definition["items"]
        if not isinstance(items, Schema):
            _validate_definition(items)
    if definition.get("type") == "object" and definition.get("shape") is not None:
        shape = definition["shape"]
        if not isinstance(shape, dict) or isinstance(shape, list):
            raise TypeError("object shape must be an object")
        for child in shape.values():
            if not isinstance(child, Schema):
                _validate_definition(child)


def _normalize_schema(value: Any) -> Any:
    return value.definition if isinstance(value, Schema) else value


class Schema:
    def __init__(self, definition: Dict[str, Any]) -> None:
        _validate_definition(definition)
        self.definition = _freeze(definition)
        try:
            self._frozen = True
        except Exception:
            pass

    def safeParse(self, value: Any, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        options = options or {}
        issues: List[Any] = []
        data = _validate_node(self.definition, value, "$", issues, coerce=options.get("coerce") is True)
        if issues:
            return _FrozenDict({"success": False, "data": _MISSING, "issues": tuple(issues)})
        return _FrozenDict({"success": True, "data": data, "issues": ()})

    def parse(self, value: Any, options: Optional[Dict[str, Any]] = None) -> Any:
        result = self.safeParse(value, options)
        if not result["success"]:
            raise ValidationError(list(result["issues"]))
        return result["data"]


def schema(definition: Dict[str, Any]) -> Schema:
    return Schema(definition)


class _FrozenNamespace:
    def __init__(self, **kwargs: Any) -> None:
        self._d = dict(kwargs)

    def __getattr__(self, name: str) -> Any:
        if name in self._d:
            return self._d[name]
        raise AttributeError(name)


validators = _FrozenNamespace(
    string=lambda options=None: schema({"type": "string", **(options or {})}),
    number=lambda options=None: schema({"type": "number", **(options or {})}),
    integer=lambda options=None: schema({"type": "integer", **(options or {})}),
    boolean=lambda options=None: schema({"type": "boolean", **(options or {})}),
    array=lambda items=None, options=None: schema({"type": "array", "items": _normalize_schema(items), **(options or {})}),
    object=lambda shape=None, options=None: schema({"type": "object", "shape": {k: _normalize_schema(v) for k, v in (shape or {}).items()}, **(options or {})}),
    literal=lambda value: schema({"type": "any", "literal": value}),
)
