"""Contract-grounded native tests for the Sovereign URL / Query / Encoding Python port."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_url import (
    UrlError,
    base64_decode,
    base64_encode,
    base64url_decode,
    base64url_encode,
    build_query,
    decode_path_segment,
    decode_uri_component_strict,
    decode_uri_component_tolerant,
    encode_path_segment,
    encode_uri_component_safe,
    form_decode,
    form_encode,
    parse_query,
    parse_url,
    utf8_decode,
    utf8_encode,
)


def test_url_parsing_normalizes_absolute_urls_and_exposes_immutable_metadata():
    parsed = parse_url("https://example.com/a?q=1#x")
    assert parsed["protocol"] == "https:"
    assert parsed["pathname"] == "/a"
    with pytest.raises(TypeError):
        parsed["pathname"] = "/other"


def test_query_parsing_preserves_duplicates_and_builder_is_deterministic():
    assert parse_query("?a=1&a=2&b=x") == {"a": ("1", "2"), "b": ("x",)}
    assert build_query({"a": ["1", "2"], "b": "x"}) == "a=1&a=2&b=x"
    assert form_decode(form_encode({"q": "hello world"})) == {"q": ("hello world",)}


def test_percent_decoding_is_explicitly_strict_or_tolerant():
    assert decode_uri_component_strict("hello%20world") == "hello world"
    with pytest.raises(UrlError) as exc:
        decode_uri_component_strict("%ZZ")
    assert exc.value.code == "INVALID_PERCENT_ENCODING"
    assert decode_uri_component_tolerant("%ZZ%20ok") == "%ZZ ok"


def test_utf8_helpers_support_unicode_and_fatal_invalid_bytes():
    encoded = utf8_encode("مصر")
    assert utf8_decode(encoded) == "مصر"
    with pytest.raises(UrlError) as exc:
        utf8_decode(b"\xff", {"fatal": True})
    assert exc.value.code == "INVALID_UTF8"


def test_base64_and_base64url_round_trip_deterministically():
    encoded = base64_encode("hello")
    assert encoded == "aGVsbG8="
    assert base64_decode(encoded) == b"hello"
    source = utf8_encode("a?b/c")
    url = base64url_encode(source)
    assert base64url_decode(url) == source


def test_path_segment_helpers_use_component_semantics():
    encoded = encode_path_segment("a/b")
    assert encoded == "a%2Fb"
    assert decode_path_segment(encoded) == "a/b"
    assert encode_uri_component_safe("!~*'()") == "!~*'()"


def test_size_limits_and_malformed_inputs_are_deterministic():
    with pytest.raises(UrlError) as exc:
        parse_url("https://example.com", {"maxBytes": 1})
    assert exc.value.code == "INPUT_TOO_LARGE"

    with pytest.raises(UrlError) as exc:
        parse_query("abc", {"maxBytes": 2})
    assert exc.value.code == "INPUT_TOO_LARGE"

    with pytest.raises(UrlError) as exc:
        base64_decode("abc")
    assert exc.value.code == "INVALID_BASE64"

    with pytest.raises(UrlError) as exc:
        base64url_decode("a")
    assert exc.value.code == "INVALID_BASE64URL"


def test_relative_url_requires_a_valid_base():
    parsed = parse_url("nested/file.txt", {"base": "https://example.com/root/"})
    assert parsed["href"] == "https://example.com/root/nested/file.txt"
    with pytest.raises(UrlError) as exc:
        parse_url("x", {"base": "not a url"})
    assert exc.value.code == "INVALID_URL"
