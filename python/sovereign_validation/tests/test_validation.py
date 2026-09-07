"""Native tests for the VAL1 validation Python port (contract-grounded)."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_validation import Schema, schema, validators, ValidationError


def test_string_valid():
    s = schema({"type": "string"})
    assert s.parse("hi") == "hi"
    assert s.safeParse(123)["success"] is False


def test_string_length():
    s = schema({"type": "string", "minLength": 2, "maxLength": 4})
    assert s.parse("abc") == "abc"
    assert s.safeParse("a")["success"] is False
    assert s.safeParse("abcde")["success"] is False


def test_string_pattern():
    s = schema({"type": "string", "pattern": r"^[a-z]+$"})
    assert s.parse("abc") == "abc"
    assert s.safeParse("ABC")["success"] is False


def test_integer_range():
    s = schema({"type": "integer", "min": 0, "max": 10})
    assert s.parse(5) == 5
    assert s.safeParse(-1)["success"] is False
    assert s.safeParse(11)["success"] is False
    assert s.safeParse(3.5)["success"] is False  # not integer


def test_boolean():
    s = schema({"type": "boolean"})
    assert s.parse(True) is True
    assert s.safeParse("x")["success"] is False


def test_enum():
    s = schema({"type": "string", "enum": ["a", "b"]})
    assert s.parse("a") == "a"
    assert s.safeParse("c")["success"] is False


def test_literal():
    s = schema({"type": "any", "literal": 7})
    assert s.parse(7) == 7
    assert s.safeParse(8)["success"] is False


def test_array_items():
    s = schema({"type": "array", "items": {"type": "integer", "min": 0}})
    assert s.parse([1, 2, 3]) == [1, 2, 3]
    assert s.safeParse([1, -1])["success"] is False  # -1 fails min


def test_array_length():
    s = schema({"type": "array", "items": {"type": "integer"}, "minItems": 1, "maxItems": 2})
    assert s.parse([1]) == [1]
    assert s.safeParse([])["success"] is False
    assert s.safeParse([1, 2, 3])["success"] is False


def test_object_shape_preserve():
    s = schema({"type": "object", "shape": {"a": {"type": "integer"}}})
    out = s.parse({"a": 1, "extra": "kept"})
    assert out == {"a": 1, "extra": "kept"}


def test_object_shape_strip():
    s = schema({"type": "object", "shape": {"a": {"type": "integer"}}, "unknownKeys": "strip"})
    assert s.parse({"a": 1, "extra": "x"}) == {"a": 1}


def test_object_shape_error():
    s = schema({"type": "object", "shape": {"a": {"type": "integer"}}, "unknownKeys": "error"})
    res = s.safeParse({"a": 1, "extra": "x"})
    assert res["success"] is False
    assert any(i["code"] == "UNKNOWN_KEY" for i in res["issues"])


def test_required_and_default():
    s = schema({"type": "object", "shape": {"a": {"type": "integer", "required": True}, "b": {"type": "integer", "default": 5}}})
    assert s.parse({"a": 1}) == {"a": 1, "b": 5}
    assert s.safeParse({})["success"] is False  # a required missing


def test_coerce():
    s2 = schema({"type": "integer"})
    assert s2.parse("42", {"coerce": True}) == 42
    b = schema({"type": "boolean"})
    assert b.parse("true", {"coerce": True}) is True
    assert b.parse("0", {"coerce": True}) is False
    assert s2.safeParse("nope")["success"] is False  # not coercible to integer


def test_custom_validate():
    s = schema({"type": "integer", "validate": lambda v, ctx: "must be even" if v % 2 else True})
    assert s.parse(4) == 4
    assert s.safeParse(3)["success"] is False


def test_validators_factory():
    assert validators.string().parse("x") == "x"
    assert validators.integer({"min": 0}).parse(3) == 3
    assert validators.object({"name": {"type": "string"}}).parse({"name": "z"}) == {"name": "z"}
    assert validators.literal(9).parse(9) == 9


def test_parse_throws_validation_error():
    import pytest
    s = schema({"type": "string"})
    with pytest.raises(ValidationError) as exc:
        s.parse(123)
    assert exc.value.code == "VALIDATION_FAILED"
    assert len(exc.value.issues) >= 1


def test_validation_error_immutable():
    s = schema({"type": "string"})
    try:
        s.parse(123)
        assert False
    except ValidationError as e:
        try:
            e.issues = []
            assert False, "should be immutable"
        except (AttributeError, TypeError):
            pass
