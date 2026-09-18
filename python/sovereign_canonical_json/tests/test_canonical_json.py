"""Native tests for the CJSON1 canonical-json Python port (contract-grounded)."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_canonical_json import (  # noqa: E402
    canonicalStringify,
    normalize,
    createCanonicalizer,
    CanonicalJsonError,
    CANONICAL_JSON_FORMAT,
    CANONICAL_JSON_LIMITS,
    DEFAULT_MAX_DEPTH,
    DEFAULT_MAX_NODES,
    DEFAULT_MAX_STRING_BYTES,
    DEFAULT_MAX_VALUE_BYTES,
)


def test_format_constants():
    assert CANONICAL_JSON_FORMAT == "CJSON1"
    assert CANONICAL_JSON_LIMITS == {
        "MAX_DEPTH": DEFAULT_MAX_DEPTH,
        "MAX_NODES": DEFAULT_MAX_NODES,
        "MAX_STRING_BYTES": DEFAULT_MAX_STRING_BYTES,
        "MAX_VALUE_BYTES": DEFAULT_MAX_VALUE_BYTES,
    }


def test_key_order_deterministic():
    a = canonicalStringify({"z": 1, "a": 2, "m": 3})
    b = canonicalStringify({"a": 2, "m": 3, "z": 1})
    assert a == b == '{"a":2,"m":3,"z":1}'


def test_normalize_is_sorted_dict():
    out = normalize({"b": 2, "a": 1})
    assert list(out.keys()) == ["a", "b"]
    assert out == {"a": 1, "b": 2}


def test_negative_zero_canonicalizes_to_zero():
    assert canonicalStringify(-0) == "0"


def test_float_shortest_roundtrip():
    assert canonicalStringify(0.1 + 0.2) == "0.30000000000000004"


def test_unicode_not_escaped():
    assert canonicalStringify({"k": "héllo—ω"}) == '{"k":"héllo—ω"}'


def test_nested_arrays():
    assert canonicalStringify([1, [2, [3]]]) == "[1,[2,[3]]]"


def test_rejects_nan():
    import math
    try:
        canonicalStringify(math.nan)
        assert False, "expected CanonicalJsonError"
    except CanonicalJsonError as e:
        assert e.code == "UNSUPPORTED_VALUE"


def test_rejects_infinity():
    try:
        canonicalStringify(float("inf"))
        assert False, "expected CanonicalJsonError"
    except CanonicalJsonError as e:
        assert e.code == "UNSUPPORTED_VALUE"


def test_rejects_circular():
    o = {}
    o["self"] = o
    try:
        canonicalStringify(o)
        assert False, "expected CanonicalJsonError"
    except CanonicalJsonError as e:
        assert e.code == "CIRCULAR_REFERENCE"


def test_rejects_nonplain_object():
    class NonPlain(dict):
        pass
    try:
        canonicalStringify(NonPlain())
        assert False, "expected CanonicalJsonError"
    except CanonicalJsonError as e:
        assert e.code == "UNSUPPORTED_OBJECT"


def test_rejects_excess_depth():
    deep = 1
    for _ in range(DEFAULT_MAX_DEPTH + 1):
        deep = [deep]
    try:
        canonicalStringify(deep)
        assert False, "expected CanonicalJsonError"
    except CanonicalJsonError as e:
        assert e.code == "DEPTH_LIMIT"


def test_createCanonicalizer_returns_callable_api():
    c = createCanonicalizer()
    assert callable(c.normalize)
    assert callable(c.stringify)
    assert c.stringify({"a": 1}) == '{"a":1}'
