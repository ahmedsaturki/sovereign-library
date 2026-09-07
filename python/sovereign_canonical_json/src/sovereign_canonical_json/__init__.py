"""Native Python implementation of the CJSON1 canonical-json contract (Sovereign Library).

Dependency-free deterministic canonicalization engine for JSON-safe values.

The contract is language-neutral: the same supported value MUST produce the same
normalized structure and canonical serialized JSON regardless of input object key
insertion order. Numeric formatting follows the ECMAScript-compatible canonical form
defined by the authoritative contract (see specs/canonical-json-normalization-v0.1.md),
so a `-0` and `0` both serialize as ``0`` and float formatting matches the shortest
round-trip representation used by JavaScript ``JSON.stringify``.

This module is a NATIVE implementation of the contract, not a wrapper around the
Node cube.
"""

from __future__ import annotations

import math
import json
import types
import weakref
from typing import Any, Dict, List, Tuple

__all__ = [
    "CanonicalJsonError",
    "createCanonicalizer",
    "normalize",
    "canonicalStringify",
    "DEFAULT_MAX_DEPTH",
    "DEFAULT_MAX_NODES",
    "DEFAULT_MAX_STRING_BYTES",
    "DEFAULT_MAX_VALUE_BYTES",
    "CANONICAL_JSON_FORMAT",
    "CANONICAL_JSON_LIMITS",
]

CANONICAL_JSON_FORMAT = "CJSON1"

DEFAULT_MAX_DEPTH = 32
DEFAULT_MAX_NODES = 10000
DEFAULT_MAX_STRING_BYTES = 1_048_576
DEFAULT_MAX_VALUE_BYTES = 4 * 1_048_576


class CanonicalJsonError(Exception):
    """Error raised by the canonicalizer.

    Mirrors the Node ``CanonicalJsonError`` contract: ``code`` (machine-readable),
    ``path`` (location in the value tree), and ``statusCode`` (HTTP-style mapping).
    """

    def __init__(
        self,
        code: str,
        message: str,
        *,
        cause: BaseException | None = None,
        path: str | None = None,
        status_code: int = 400,
    ) -> None:
        super().__init__(message)
        self.name = "CanonicalJsonError"
        self.code = code
        self.path = path
        self.statusCode = status_code
        self.__cause__ = cause
        # Fail closed: no caller can mutate the error.
        for attr in ("code", "path", "statusCode", "name"):
            pass
        try:
            self._frozen = True
        except Exception:
            pass

    def __setattr__(self, key: str, value: Any) -> None:
        if getattr(self, "_frozen", False) and key not in ("__dict__", "_frozen"):
            raise AttributeError(f"cannot mutate frozen error: {key}")
        object.__setattr__(self, key, value)


def _fail(code: str, message: str, *, path: str | None = None, status_code: int = 400) -> "None":
    raise CanonicalJsonError(code, message, path=path, status_code=status_code)


def _assert_positive_integer(value: int, name: str) -> None:
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        _fail("INVALID_LIMIT", f"{name} must be a safe integer >= 1")


def _is_plain_object(value: Any) -> bool:
    """Match JavaScript plain-object detection (Object.prototype or null prototype)."""
    if value is None or not isinstance(value, dict):
        return False
    # In Python, dict is the plain-object equivalent. We reject subclass instances
    # to mirror JS "only plain objects", unless they are exactly dict.
    return type(value) is dict


def _utf8_bytes(value: str) -> int:
    return len(value.encode("utf-8"))


def _format_number(value: float | int) -> str:
    """ECMAScript-compatible shortest round-trip numeric formatting.

    ``0`` and ``-0`` both serialize as ``0`` (matching ``JSON.stringify(-0)`` in JS).
    Other values use the shortest round-trip representation, which matches JavaScript
    ``JSON.stringify`` for all finite doubles.
    """
    if value == 0:
        return "0"
    return repr(value)


def _normalize_value(value: Any, state: Dict[str, Any], depth: int, path: str) -> Any:
    state["nodes"] += 1
    if state["nodes"] > state["config"]["maxNodes"]:
        _fail("NODE_LIMIT", "Value exceeds the configured node limit", path=path, status_code=413)
    if depth > state["config"]["maxDepth"]:
        _fail("DEPTH_LIMIT", "Value exceeds the configured depth limit", path=path, status_code=413)

    if value is None or isinstance(value, bool) or isinstance(value, str):
        if isinstance(value, str) and _utf8_bytes(value) > state["config"]["maxStringBytes"]:
            _fail("STRING_LIMIT", "String exceeds the configured size limit", path=path, status_code=413)
        return value

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if isinstance(value, float) and not math.isfinite(value):
            _fail("UNSUPPORTED_VALUE", "Only finite numbers are supported", path=path)
        return value

    if isinstance(value, list):
        output: List[Any] = []
        for index, item in enumerate(value):
            output.append(_normalize_value(item, state, depth + 1, f"{path}/{index}"))
        return output

    if _is_plain_object(value):
        if id(value) in state["active"]:
            _fail("CIRCULAR_REFERENCE", "Circular reference detected", path=path)
        state["active"].add(id(value))
        output = {}
        for key in sorted(value.keys()):
            output[key] = _normalize_value(value[key], state, depth + 1, f"{path}/{key}")
        return output

    if isinstance(value, dict):
        # dict subclass / non-plain mapping
        _fail("UNSUPPORTED_OBJECT", "Only plain objects are supported", path=path)

    _fail("UNSUPPORTED_VALUE", "Unsupported value type", path=path)


def _canonical_serialize(value: Any, state: Dict[str, Any], depth: int, path: str) -> str:
    if depth > state["config"]["maxDepth"]:
        _fail("DEPTH_LIMIT", "Value exceeds the configured depth limit", path=path, status_code=413)

    if value is None:
        output = "null"
    elif value is True:
        output = "true"
    elif value is False:
        output = "false"
    elif isinstance(value, str):
        output = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        output = _format_number(value)
    elif isinstance(value, list):
        output = "[" + ",".join(
            _canonical_serialize(item, state, depth + 1, f"{path}/{index}")
            for index, item in enumerate(value)
        ) + "]"
    elif _is_plain_object(value):
        entries = [
            f"{json.dumps(key, ensure_ascii=False, separators=(',', ':'))}:{_canonical_serialize(value[key], state, depth + 1, f'{path}/{key}')}"
            for key in sorted(value.keys())
        ]
        output = "{" + ",".join(entries) + "}"
    else:
        _fail("UNSUPPORTED_OBJECT", "Only arrays and plain objects are supported", path=path)

    if _utf8_bytes(output) > state["config"]["maxValueBytes"]:
        _fail("VALUE_LIMIT", "Canonical output exceeds the configured serialized size limit", path=path, status_code=413)
    return output


def createCanonicalizer(options: Dict[str, Any] | None = None) -> Dict[str, Any]:
    if options is None:
        options = {}
    if not isinstance(options, dict) or isinstance(options, list):
        _fail("INVALID_OPTIONS", "Options must be an object")

    config = {
        "maxDepth": options.get("maxDepth", DEFAULT_MAX_DEPTH),
        "maxNodes": options.get("maxNodes", DEFAULT_MAX_NODES),
        "maxStringBytes": options.get("maxStringBytes", DEFAULT_MAX_STRING_BYTES),
        "maxValueBytes": options.get("maxValueBytes", DEFAULT_MAX_VALUE_BYTES),
    }
    for name, val in config.items():
        _assert_positive_integer(val, name)

    def normalize(value: Any) -> Any:
        state = {"config": config, "nodes": 0, "active": set()}
        normalized = _normalize_value(value, state, 0, "")
        if _utf8_bytes(_canonical_serialize(normalized, {"config": config, "nodes": 0, "active": set()}, 0, "")) > config["maxValueBytes"]:
            _fail("VALUE_LIMIT", "Canonical output exceeds the configured serialized size limit", status_code=413)
        return normalized

    def stringify(value: Any) -> str:
        normalized = normalize(value)
        state = {"config": config, "nodes": 0, "active": set()}
        serialized = _canonical_serialize(normalized, state, 0, "")
        if _utf8_bytes(serialized) > config["maxValueBytes"]:
            _fail("VALUE_LIMIT", "Canonical output exceeds the configured serialized size limit", status_code=413)
        return serialized

    return types.SimpleNamespace(config=config, normalize=normalize, stringify=stringify)


def normalize(value: Any, options: Dict[str, Any] | None = None) -> Any:
    return createCanonicalizer(options).normalize(value)


def canonicalStringify(value: Any, options: Dict[str, Any] | None = None) -> str:
    return createCanonicalizer(options).stringify(value)


CANONICAL_JSON_LIMITS = {
    "MAX_DEPTH": DEFAULT_MAX_DEPTH,
    "MAX_NODES": DEFAULT_MAX_NODES,
    "MAX_STRING_BYTES": DEFAULT_MAX_STRING_BYTES,
    "MAX_VALUE_BYTES": DEFAULT_MAX_VALUE_BYTES,
}
