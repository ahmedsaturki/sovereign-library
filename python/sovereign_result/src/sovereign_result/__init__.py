"""Native Python implementation of the RES1 result contract (Sovereign Library).

Dependency-free Result/error wrapper used pervasively across Sovereign Cubes.

A Result is a frozen tagged object: ``{"__sov_result__": True, "ok": bool, ...}``.
Success carries ``value``; failure carries ``error`` (a ``ResultError``). This mirrors
the Node contract (which tags with a Symbol) using a private marker so untrusted
dictionaries cannot masquerade as Results.

This is a NATIVE implementation of the contract, not a wrapper around the Node cube.
"""

from __future__ import annotations

import copy
import types
from typing import Any, Callable, Dict, Optional, Tuple, TypeVar

__all__ = [
    "ResultError",
    "Result",
    "errors",
    "serializeError",
    "normalizeError",
    "RESULT_FORMAT",
]

RESULT_FORMAT = "RES1"

_T = TypeVar("_T")
_E = TypeVar("_E")

_MARKER = "__sov_result__"


class ResultError(Exception):
    """Error type carried by a failed Result.

    Mirrors the Node ``ResultError`` contract: ``code``, ``retryable``, ``cancelled``,
    ``timedOut``, ``details``, and ``cause``. Fail-closed: frozen, never mutable after
    construction.
    """

    def __init__(
        self,
        code: str,
        message: str,
        *,
        cause: Optional[BaseException] = None,
        retryable: bool = False,
        cancelled: bool = False,
        timedOut: bool = False,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.name = "ResultError"
        self.code = code
        self.retryable = retryable is True
        self.cancelled = cancelled is True
        self.timedOut = timedOut is True
        self.details = _freeze_snapshot(details)
        self.__cause__ = cause
        try:
            self._frozen = True
        except Exception:
            pass

    def __setattr__(self, key: str, value: Any) -> None:
        if getattr(self, "_frozen", False) and key not in ("_frozen", "__cause__"):
            raise AttributeError(f"cannot mutate frozen error: {key}")
        object.__setattr__(self, key, value)

    def __reduce__(self):
        # Allow pickling/copying of error instances for snapshot fidelity.
        return (
            _rebuild_error,
            (self.code, self.message, self.retryable, self.cancelled,
             self.timedOut, self.details, None),
        )


def _rebuild_error(code, message, retryable, cancelled, timedOut, details, _cause):
    return ResultError(code, message, retryable=retryable, cancelled=cancelled,
                       timedOut=timedOut, details=details)


def _freeze_snapshot(value: Any, _seen: Optional[set] = None) -> Any:
    if _seen is None:
        _seen = set()
    if not isinstance(value, (dict, list)):
        return value
    ident = id(value)
    if ident in _seen:
        return value
    _seen.add(ident)
    if isinstance(value, list):
        return tuple(_freeze_snapshot(v, _seen) for v in value)
    return _FrozenDict({k: _freeze_snapshot(v, _seen) for k, v in value.items()})


class _FrozenDict(dict):
    """A dict that rejects post-construction mutation (fail-closed snapshot)."""

    def _immutable(self, *a, **k):
        raise TypeError("cannot mutate frozen snapshot")

    __setitem__ = _immutable
    __delitem__ = _immutable
    clear = _immutable
    pop = _immutable
    popitem = _immutable
    setdefault = _immutable
    update = _immutable

    def __hash__(self):  # type: ignore[override]
        return hash(tuple(sorted((k, id(v)) for k, v in self.items())))


def _normalize_error(error: Any, fallback_code: str = "UNKNOWN_ERROR") -> "ResultError":
    if isinstance(error, ResultError):
        return error
    if isinstance(error, Exception):
        return ResultError(fallback_code, str(error) or fallback_code, cause=error)
    msg = error if isinstance(error, str) else "unknown error"
    return ResultError(fallback_code, msg, details={"value": error})


def _success(value: Any) -> Dict[str, Any]:
    return _FrozenDict({_MARKER: True, "ok": True, "value": value})


def _failure(error: Any) -> Dict[str, Any]:
    return _FrozenDict({_MARKER: True, "ok": False, "error": _normalize_error(error)})


def _assert_result(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict) or value.get(_MARKER) is not True:
        raise TypeError("expected Sovereign Result")
    return value


class _Result:
    """Static namespace mirroring the Node ``Result`` contract."""

    @staticmethod
    def ok(value: Any) -> Dict[str, Any]:
        return _success(value)

    @staticmethod
    def err(error: Any) -> Dict[str, Any]:
        return _failure(error)

    @staticmethod
    def from_(value: Any) -> Dict[str, Any]:
        if isinstance(value, dict) and value.get(_MARKER) is True:
            return value
        return _success(value)

    @staticmethod
    def fromThrowable(fn: Callable[[], _T], options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        options = options or {}
        try:
            return _success(fn())
        except Exception as error:  # noqa: BLE001
            return _failure(_normalize_error(error, options.get("code", "UNKNOWN_ERROR")))

    @staticmethod
    def fromPromise(promise, options: Optional[Dict[str, Any]] = None):  # async variant
        options = options or {}
        try:
            value = _await(promise)
            return _success(value)
        except Exception as error:  # noqa: BLE001
            return _failure(_normalize_error(error, options.get("code", "UNKNOWN_ERROR")))

    @staticmethod
    def is_(value: Any) -> bool:
        return isinstance(value, dict) and value.get(_MARKER) is True

    @staticmethod
    def unwrap(value: Any) -> Any:
        result = _assert_result(value)
        if not result["ok"]:
            raise result["error"]
        return result["value"]

    @staticmethod
    def unwrapOr(value: Any, fallback: Any) -> Any:
        result = _assert_result(value)
        return result["value"] if result["ok"] else fallback

    @staticmethod
    def map(value: Any, fn: Callable[[_T], _E]) -> Dict[str, Any]:
        result = _assert_result(value)
        return _success(fn(result["value"])) if result["ok"] else result

    @staticmethod
    def mapErr(value: Any, fn: Callable[[Any], Any]) -> Dict[str, Any]:
        result = _assert_result(value)
        if result["ok"]:
            return result
        return _failure(fn(result["error"]))

    @staticmethod
    def andThen(value: Any, fn: Callable[[_T], Any]) -> Dict[str, Any]:
        result = _assert_result(value)
        if not result["ok"]:
            return result
        return _assert_result(fn(result["value"]))

    @staticmethod
    def recover(value: Any, fn: Callable[[Any], Any]) -> Dict[str, Any]:
        result = _assert_result(value)
        if result["ok"]:
            return result
        return _assert_result(fn(result["error"]))

    @staticmethod
    def match(value: Any, handlers: Dict[str, Callable]) -> Any:
        result = _assert_result(value)
        return handlers["ok"](result["value"]) if result["ok"] else handlers["err"](result["error"])

    @staticmethod
    def ensure(value: Any, predicate: Callable[[Any], bool],
              error: Optional[Any] = None) -> Dict[str, Any]:
        result = _assert_result(value)
        if not result["ok"]:
            return result
        if predicate(result["value"]):
            return result
        return _failure(error if error is not None else
                      ResultError("UNKNOWN_ERROR", "result validation failed"))


def _await(promise):
    """Resolve an awaitable or already-resolved value without forcing async context."""
    if hasattr(promise, "__await__"):
        return _run_until(promise)
    return promise


def _run_until(awaitable):
    gen = awaitable.__await__()
    try:
        while True:
            try:
                gen.send(None)
            except StopIteration as stop:
                return stop.value
    except RuntimeError:
        # No running event loop; fall back to a minimal coroutine runner.
        return _drive(awaitable)


def _drive(coro):
    try:
        while True:
            coro.send(None)
    except StopIteration as stop:
        return stop.value


def serializeError(error: Any, _seen: Optional[set] = None) -> Dict[str, Any]:
    if _seen is None:
        _seen = set()
    source = error if isinstance(error, ResultError) else _normalize_error(error)
    if id(source) in _seen:
        return _FrozenDict({
            "name": source.name, "code": source.code or "UNKNOWN_ERROR",
            "message": "[circular cause]", "retryable": bool(source.retryable),
            "cancelled": bool(source.cancelled), "timedOut": bool(source.timedOut),
        })
    _seen.add(id(source))
    cause = source.__cause__ if isinstance(source.__cause__, Exception) else None
    return _FrozenDict({
        "name": source.name or "Error",
        "code": source.code or "UNKNOWN_ERROR",
        "message": str(source) or "unknown error",
        "retryable": bool(source.retryable),
        "cancelled": bool(source.cancelled),
        "timedOut": bool(source.timedOut),
        "details": source.details,
        "cause": serializeError(cause, _seen) if cause is not None else None,
    })


def normalizeError(error: Any, fallback_code: str = "UNKNOWN_ERROR") -> "ResultError":
    return _normalize_error(error, fallback_code)


Result = _Result()

errors = types.SimpleNamespace(
    normalize=_normalize_error,
    unknown=lambda message="unknown error", details=None: ResultError("UNKNOWN_ERROR", message, details=details),
    cancelled=lambda message="operation cancelled", details=None: ResultError("CANCELLED", message, cancelled=True, details=details),
    timedOut=lambda message="operation timed out", details=None: ResultError("TIMEOUT", message, timedOut=True, retryable=True, details=details),
    retryable=lambda code, message, options=None: ResultError(code, message, retryable=True, **(options or {})),
    validation=lambda message, details=None: ResultError("VALIDATION_FAILED", message, details=details),
)
