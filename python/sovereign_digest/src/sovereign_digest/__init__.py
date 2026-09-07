"""Native Python implementation of the DIG1 digest contract (Sovereign Library).

Dependency-free deterministic hashing/HMAC with constant-time comparison.

Pure-logic:
- ``sha256``/``sha512``/``hmacSha256``/``hmacSha512`` return ``bytes`` (mirrors Node Buffer)
- ``digestHex``/``hmacHex`` return hex strings (JSON-friendly, used for conformance vectors)
- ``constantTimeEqual`` constant-time byte comparison
- ``digestAsync``/``hmacAsync`` streamed async hashing (mirrors Node async iterables)

This is a NATIVE implementation of the contract, not a wrapper around the Node cube.
"""

from __future__ import annotations

import hashlib
import hmac as _hmac
from typing import Any, Dict, Optional, Union

__all__ = [
    "DigestError",
    "sha256", "sha512",
    "hmacSha256", "hmacSha512",
    "digestHex", "hmacHex",
    "digestAsync", "hmacAsync",
    "constantTimeEqual",
    "createDigestConfig",
    "DEFAULT_MAX_INPUT_BYTES", "DEFAULT_MAX_CHUNK_BYTES", "DEFAULT_MAX_TOTAL_BYTES",
]

DEFAULT_MAX_INPUT_BYTES = 5 * 1024 * 1024
DEFAULT_MAX_CHUNK_BYTES = 1 * 1024 * 1024
DEFAULT_MAX_TOTAL_BYTES = 256 * 1024 * 1024
SUPPORTED_HASHES = {"sha256", "sha512"}

# Sentinel distinguishes "no argument" (→ default {}) from explicit None (→ invalid),
# matching Node's `undefined` (default {}) vs `null` (throws INVALID_OPTIONS) semantics.
_UNSET = object()


def _coerce_opts(options):
    if options is _UNSET:
        return {}
    return options

BytesLike = Union[str, bytes, bytearray]


class DigestError(Exception):
    """Error type for digest operations. Fail-closed: frozen after construction."""

    def __init__(self, code: str, message: str, *, operation: Optional[str] = None,
                 statusCode: int = 400, cause: Optional[BaseException] = None) -> None:
        super().__init__(message)
        self.name = "DigestError"
        self.code = code
        self.operation = operation
        self.statusCode = statusCode
        self.__cause__ = cause
        try:
            self._frozen = True
        except Exception:
            pass

    def __setattr__(self, key: str, value: Any) -> None:
        if getattr(self, "_frozen", False) and key not in ("_frozen", "__cause__"):
            raise AttributeError(f"cannot mutate frozen error: {key}")
        object.__setattr__(self, key, value)


def _assert_positive_limit(value: Any, name: str) -> None:
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise DigestError("INVALID_LIMIT", f"{name} must be a safe integer >= 1")


def _normalize_options(options: Optional[Dict[str, Any]] = None) -> Dict[str, int]:
    if options is None or not isinstance(options, dict) or isinstance(options, list):
        raise DigestError("INVALID_OPTIONS", "Digest options must be an object")
    max_input = options.get("maxInputBytes", DEFAULT_MAX_INPUT_BYTES)
    max_chunk = options.get("maxChunkBytes", DEFAULT_MAX_CHUNK_BYTES)
    max_total = options.get("maxTotalBytes", DEFAULT_MAX_TOTAL_BYTES)
    _assert_positive_limit(max_input, "maxInputBytes")
    _assert_positive_limit(max_chunk, "maxChunkBytes")
    _assert_positive_limit(max_total, "maxTotalBytes")
    return {"maxInputBytes": max_input, "maxChunkBytes": max_chunk, "maxTotalBytes": max_total}


def _normalize_algorithm(algorithm: str) -> str:
    if not isinstance(algorithm, str):
        raise DigestError("INVALID_ALGORITHM", "Algorithm must be a string")
    normalized = algorithm.lower().replace("-", "")
    if normalized not in SUPPORTED_HASHES:
        raise DigestError("UNSUPPORTED_ALGORITHM", f"Unsupported hash algorithm: {algorithm}")
    return normalized


def _to_bytes(input: BytesLike) -> bytes:
    if isinstance(input, str):
        return input.encode("utf8")
    if isinstance(input, (bytes, bytearray)):
        return bytes(input)
    raise DigestError("INVALID_INPUT", "Input must be a string or bytes-like")


def _digest_bytes(algorithm: str, input: BytesLike, options: Optional[Dict[str, Any]], operation: str) -> bytes:
    config = _normalize_options(options)
    normalized = _normalize_algorithm(algorithm)
    data = _to_bytes(input)
    if len(data) > config["maxInputBytes"]:
        raise DigestError("INPUT_TOO_LARGE", f"Input exceeds {config['maxInputBytes']} bytes",
                          operation=operation, statusCode=413)
    try:
        h = hashlib.new(normalized)
        h.update(data)
        return h.digest()
    except DigestError:
        raise
    except Exception as cause:  # noqa: BLE001
        raise DigestError("DIGEST_FAILED", "Digest operation failed", operation=operation, cause=cause)


def _hmac_bytes(algorithm: str, key: BytesLike, input: BytesLike,
                options: Optional[Dict[str, Any]], operation: str) -> bytes:
    config = _normalize_options(options)
    secret = _to_bytes(key)
    if len(secret) > config["maxInputBytes"]:
        raise DigestError("KEY_TOO_LARGE", f"Key exceeds {config['maxInputBytes']} bytes",
                          operation=operation, statusCode=413)
    data = _to_bytes(input)
    if len(data) > config["maxInputBytes"]:
        raise DigestError("INPUT_TOO_LARGE", f"Input exceeds {config['maxInputBytes']} bytes",
                          operation=operation, statusCode=413)
    normalized = _normalize_algorithm(algorithm)
    try:
        return _hmac.new(secret, data, normalized).digest()
    except DigestError:
        raise
    except Exception as cause:  # noqa: BLE001
        raise DigestError("HMAC_FAILED", "HMAC operation failed", operation=operation, cause=cause)


def sha256(input: BytesLike, options: Any = _UNSET) -> bytes:
    return _digest_bytes("sha256", input, _coerce_opts(options), "sha256")


def sha512(input: BytesLike, options: Any = _UNSET) -> bytes:
    return _digest_bytes("sha512", input, _coerce_opts(options), "sha512")


def hmacSha256(key: BytesLike, input: BytesLike, options: Any = _UNSET) -> bytes:
    return _hmac_bytes("sha256", key, input, _coerce_opts(options), "hmac-sha256")


def hmacSha512(key: BytesLike, input: BytesLike, options: Any = _UNSET) -> bytes:
    return _hmac_bytes("sha512", key, input, _coerce_opts(options), "hmac-sha512")


def digestHex(algorithm: str, input: BytesLike, options: Any = _UNSET) -> str:
    return _digest_bytes(algorithm, input, _coerce_opts(options), "digest").hex()


def hmacHex(algorithm: str, key: BytesLike, input: BytesLike, options: Any = _UNSET) -> str:
    return _hmac_bytes(algorithm, key, input, _coerce_opts(options), "hmac").hex()


def createDigestConfig(options: Any = _UNSET) -> Dict[str, int]:
    return _normalize_options(_coerce_opts(options))


async def digestAsync(algorithm: str, source, options: Any = _UNSET) -> bytes:
    config = _normalize_options(_coerce_opts(options))
    normalized = _normalize_algorithm(algorithm)
    h = hashlib.new(normalized)
    total = 0
    try:
        if source is None or not hasattr(source, "__aiter__"):
            raise DigestError("INVALID_SOURCE", "Source must be an AsyncIterable")
        async for chunk in source:
            opts = _coerce_opts(options)
            if getattr(opts, "signal", None) is not None and getattr(opts.signal, "aborted", False):
                raise DigestError("CANCELLED", "Digest cancelled", statusCode=499, operation="digest")
            data = _to_bytes(chunk)
            if len(data) > config["maxChunkBytes"]:
                raise DigestError("CHUNK_TOO_LARGE", f"Chunk exceeds {config['maxChunkBytes']} bytes",
                                  statusCode=413, operation="digest")
            total += len(data)
            if total > config["maxTotalBytes"]:
                raise DigestError("INPUT_TOO_LARGE", f"Total input exceeds {config['maxTotalBytes']} bytes",
                                  statusCode=413, operation="digest")
            h.update(data)
        return h.digest()
    except DigestError:
        raise
    except Exception as cause:  # noqa: BLE001
        raise DigestError("DIGEST_FAILED", "Async digest operation failed", operation="digest", cause=cause)


async def hmacAsync(algorithm: str, key: BytesLike, source, options: Any = _UNSET) -> bytes:
    config = _normalize_options(_coerce_opts(options))
    secret = _to_bytes(key)
    if len(secret) > config["maxInputBytes"]:
        raise DigestError("KEY_TOO_LARGE", f"Key exceeds {config['maxInputBytes']} bytes",
                          statusCode=413, operation="hmac")
    normalized = _normalize_algorithm(algorithm)
    h = _hmac.new(secret, None, normalized)
    total = 0
    try:
        if source is None or not hasattr(source, "__aiter__"):
            raise DigestError("INVALID_SOURCE", "Source must be an AsyncIterable")
        async for chunk in source:
            opts = _coerce_opts(options)
            if getattr(opts, "signal", None) is not None and getattr(opts.signal, "aborted", False):
                raise DigestError("CANCELLED", "HMAC cancelled", statusCode=499, operation="hmac")
            data = _to_bytes(chunk)
            if len(data) > config["maxChunkBytes"]:
                raise DigestError("CHUNK_TOO_LARGE", f"Chunk exceeds {config['maxChunkBytes']} bytes",
                                  statusCode=413, operation="hmac")
            total += len(data)
            if total > config["maxTotalBytes"]:
                raise DigestError("INPUT_TOO_LARGE", f"Total input exceeds {config['maxTotalBytes']} bytes",
                                  statusCode=413, operation="hmac")
            h.update(data)
        return h.digest()
    except DigestError:
        raise
    except Exception as cause:  # noqa: BLE001
        raise DigestError("HMAC_FAILED", "Async HMAC operation failed", operation="hmac", cause=cause)


def constantTimeEqual(a: BytesLike, b: BytesLike) -> bool:
    if not isinstance(a, (bytes, bytearray)) or not isinstance(b, (bytes, bytearray)):
        raise DigestError("INVALID_INPUT", "Values must be bytes-like instances")
    a, b = bytes(a), bytes(b)
    if len(a) != len(b):
        return False
    return _hmac.compare_digest(a, b)
