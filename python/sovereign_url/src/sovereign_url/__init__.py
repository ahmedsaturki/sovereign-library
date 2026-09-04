"""Native Python implementation of the URL / Query / Encoding contract.

Dependency-free URL parsing, query/form encoding, percent decoding, UTF-8,
Base64/Base64URL, and path-segment helpers. The implementation is native
Python and does not invoke the Node.js implementation at runtime.
"""

from __future__ import annotations

import base64
import binascii
import re
from types import MappingProxyType
from typing import Any, Mapping, Optional
from urllib.parse import (
    parse_qsl,
    quote,
    unquote,
    unquote_to_bytes,
    urlencode,
    urljoin,
    urlsplit,
    urlunsplit,
)

__all__ = [
    "UrlError",
    "parse_url",
    "encode_uri_component_safe",
    "decode_uri_component_strict",
    "decode_uri_component_tolerant",
    "parse_query",
    "build_query",
    "form_encode",
    "form_decode",
    "utf8_encode",
    "utf8_decode",
    "base64_encode",
    "base64_decode",
    "base64url_encode",
    "base64url_decode",
    "encode_path_segment",
    "decode_path_segment",
    "DEFAULT_MAX_BYTES",
]

DEFAULT_MAX_BYTES = 1_048_576
_HEX = re.compile(r"^[0-9A-Fa-f]{2}$")
_BASE64 = re.compile(r"^[A-Za-z0-9+/]*={0,2}$")
_BASE64URL = re.compile(r"^[A-Za-z0-9_-]*$")
_COMPONENT_SAFE = "-_.!~*'()"


class UrlError(ValueError):
    """Deterministic typed URL/encoding error."""

    def __init__(self, code: str, message: str, *, status_code: int = 400, cause: Optional[BaseException] = None) -> None:
        super().__init__(message)
        self.name = "UrlError"
        self.code = code
        self.status_code = status_code
        self.cause = cause
        self.args = (message,)


def _max_bytes(options: Optional[Mapping[str, Any]]) -> int:
    value = (options or {}).get("maxBytes", DEFAULT_MAX_BYTES)
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError("maxBytes must be a safe integer >= 1")
    return value


def _assert_bounded(value: Any, name: str, max_bytes: int) -> None:
    if not isinstance(value, str):
        raise TypeError(f"{name} must be a string")
    if len(value.encode("utf-8")) > max_bytes:
        raise UrlError("INPUT_TOO_LARGE", f"{name} exceeds {max_bytes} bytes", status_code=413)


def parse_url(value: str, options: Optional[Mapping[str, Any]] = None) -> Mapping[str, str]:
    options = options or {}
    max_bytes = _max_bytes(options)
    _assert_bounded(value, "url", max_bytes)
    base = options.get("base")
    try:
        if base is not None:
            _assert_bounded(base, "base", max_bytes)
            base_parts = urlsplit(base)
            if not base_parts.scheme or not base_parts.netloc:
                raise ValueError("invalid base URL")
            value = urljoin(base, value)
        parts = urlsplit(value)
        if not parts.scheme or not parts.netloc:
            raise ValueError("absolute URL required")
        port = ""
        if parts.port is not None:
            port = str(parts.port)
        snapshot = {
            "href": urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, parts.fragment)),
            "protocol": f"{parts.scheme}:",
            "username": parts.username or "",
            "password": parts.password or "",
            "host": parts.netloc,
            "hostname": parts.hostname or "",
            "port": port,
            "pathname": parts.path,
            "search": f"?{parts.query}" if parts.query else "",
            "hash": f"#{parts.fragment}" if parts.fragment else "",
        }
        return MappingProxyType(snapshot)
    except UrlError:
        raise
    except Exception as cause:
        raise UrlError("INVALID_URL", "Invalid URL", cause=cause) from cause


def encode_uri_component_safe(value: str, options: Optional[Mapping[str, Any]] = None) -> str:
    options = options or {}
    _assert_bounded(value, "value", _max_bytes(options))
    return quote(value, safe=_COMPONENT_SAFE, encoding="utf-8", errors="strict")


def decode_uri_component_strict(value: str, options: Optional[Mapping[str, Any]] = None) -> str:
    options = options or {}
    _assert_bounded(value, "value", _max_bytes(options))
    for match in re.finditer(r"%", value):
        if not _HEX.match(value[match.start() + 1 : match.start() + 3]):
            raise UrlError("INVALID_PERCENT_ENCODING", "Invalid percent encoding")
    try:
        return unquote_to_bytes(value).decode("utf-8", errors="strict")
    except (UnicodeDecodeError, ValueError) as cause:
        raise UrlError("INVALID_PERCENT_ENCODING", "Invalid percent encoding", cause=cause) from cause


def decode_uri_component_tolerant(value: str, options: Optional[Mapping[str, Any]] = None) -> str:
    options = options or {}
    _assert_bounded(value, "value", _max_bytes(options))

    def replace(match: re.Match[str]) -> str:
        return chr(int(match.group(1), 16))

    return re.sub(r"%([0-9A-Fa-f]{2})", replace, value)


def parse_query(value: str, options: Optional[Mapping[str, Any]] = None) -> Mapping[str, tuple[str, ...]]:
    options = options or {}
    _assert_bounded(value, "query", _max_bytes(options))
    source = value[1:] if value.startswith("?") else value
    out: dict[str, list[str]] = {}
    for key, item in parse_qsl(source, keep_blank_values=True, strict_parsing=False):
        out.setdefault(key, []).append(item)
    return MappingProxyType({key: tuple(values) for key, values in out.items()})


def _js_string(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def build_query(input_value: Mapping[str, Any], options: Optional[Mapping[str, Any]] = None) -> str:
    if not isinstance(input_value, Mapping):
        raise TypeError("query input must be an object")
    options = options or {}
    pairs: list[tuple[str, str]] = []
    for key, raw in input_value.items():
        if isinstance(raw, (list, tuple)):
            for item in raw:
                pairs.append((str(key), _js_string(item)))
        elif raw is not None:
            pairs.append((str(key), _js_string(raw)))
    output = urlencode(pairs, doseq=True)
    _assert_bounded(output, "query", _max_bytes(options))
    return output


def form_encode(input_value: Mapping[str, Any], options: Optional[Mapping[str, Any]] = None) -> str:
    return build_query(input_value, options)


def form_decode(value: str, options: Optional[Mapping[str, Any]] = None) -> Mapping[str, tuple[str, ...]]:
    return parse_query(value, options)


def utf8_encode(value: str, options: Optional[Mapping[str, Any]] = None) -> bytes:
    options = options or {}
    _assert_bounded(value, "value", _max_bytes(options))
    return value.encode("utf-8")


def utf8_decode(value: bytes | bytearray | memoryview, options: Optional[Mapping[str, Any]] = None) -> str:
    options = options or {}
    data = bytes(value)
    max_bytes = _max_bytes(options)
    if len(data) > max_bytes:
        raise UrlError("INPUT_TOO_LARGE", "bytes exceed maximum size", status_code=413)
    try:
        return data.decode("utf-8", errors="strict" if options.get("fatal") is True else "replace")
    except UnicodeDecodeError as cause:
        raise UrlError("INVALID_UTF8", "Invalid UTF-8 data", cause=cause) from cause


def base64_encode(value: str | bytes | bytearray | memoryview, options: Optional[Mapping[str, Any]] = None) -> str:
    data = utf8_encode(value, options) if isinstance(value, str) else bytes(value)
    return base64.b64encode(data).decode("ascii")


def base64_decode(value: str, options: Optional[Mapping[str, Any]] = None) -> bytes:
    options = options or {}
    _assert_bounded(value, "base64", _max_bytes(options))
    if len(value) % 4 != 0 or not _BASE64.fullmatch(value):
        raise UrlError("INVALID_BASE64", "Invalid Base64 input")
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as cause:
        raise UrlError("INVALID_BASE64", "Invalid Base64 input", cause=cause) from cause


def base64url_encode(value: str | bytes | bytearray | memoryview, options: Optional[Mapping[str, Any]] = None) -> str:
    return base64_encode(value, options).replace("+", "-").replace("/", "_").rstrip("=")


def base64url_decode(value: str, options: Optional[Mapping[str, Any]] = None) -> bytes:
    options = options or {}
    _assert_bounded(value, "base64url", _max_bytes(options))
    if not _BASE64URL.fullmatch(value) or len(value) % 4 == 1:
        raise UrlError("INVALID_BASE64URL", "Invalid Base64URL input")
    padded = value.replace("-", "+").replace("_", "/")
    padded += "=" * ((4 - len(padded) % 4) % 4)
    return base64_decode(padded, options)


def encode_path_segment(value: str, options: Optional[Mapping[str, Any]] = None) -> str:
    return encode_uri_component_safe(value, options)


def decode_path_segment(value: str, options: Optional[Mapping[str, Any]] = None) -> str:
    return decode_uri_component_strict(value, options)
