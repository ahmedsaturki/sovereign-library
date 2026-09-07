"""Native Python implementation of the CACH1 cache contract (Sovereign Library).

Dependency-free TTL cache with hit/miss/eviction stats, namespace isolation, and
single-flight async `getOrCompute` (in-flight dedupe). Pure logic; no OS facilities.

This is a NATIVE implementation of the contract, not a wrapper around the Node cube.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

__all__ = [
    "CacheCubeError",
    "Cache",
    "DEFAULT_MAX_ENTRIES",
    "DEFAULT_MAX_KEY_LENGTH",
]

DEFAULT_MAX_ENTRIES = 1000
DEFAULT_MAX_KEY_LENGTH = 512


class CacheCubeError(Exception):
    """Error type for cache operations. Fail-closed: frozen after construction."""

    def __init__(self, code: str, message: str, *, retryable: bool = False, cause: Optional[BaseException] = None) -> None:
        super().__init__(message)
        self.name = "CacheCubeError"
        self.code = code
        self.retryable = bool(retryable)
        self.__cause__ = cause
        try:
            self._frozen = True
        except Exception:
            pass

    def __setattr__(self, key: str, value: Any) -> None:
        if getattr(self, "_frozen", False) and key not in (
            "_frozen", "__cause__", "__traceback__", "__context__", "__suppress_context__", "__notes__"
        ):
            raise AttributeError(f"cannot mutate frozen error: {key}")
        object.__setattr__(self, key, value)


def _assert_key(key: str, max_key_length: int) -> None:
    if not isinstance(key, str) or len(key) == 0 or len(key) > max_key_length:
        raise CacheCubeError("INVALID_KEY", f"cache key must be a non-empty string <= {max_key_length} characters")


def _create_clock(clock: Any) -> Any:
    if clock is None:
        return _Clock(lambda: time.monotonic() * 1000.0)
    if not callable(getattr(clock, "now", None)):
        raise CacheCubeError("INVALID_CLOCK", "clock must provide now()")
    # Normalize so callers always use clock.now() uniformly.
    return _Clock(clock.now)


class _Clock:
    __slots__ = ("now",)

    def __init__(self, now):
        self.now = now


def _freeze_metadata(value: Any) -> Any:
    if not isinstance(value, (dict, list)):
        return value
    if isinstance(value, list):
        return tuple(value)
    return _FrozenDict(dict(value))


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


class Cache:
    """TTL cache with namespace isolation, LRU-ish eviction, and stats."""

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        config = config or {}
        namespace = config.get("namespace", "default")
        max_entries = config.get("maxEntries", DEFAULT_MAX_ENTRIES)
        max_key_length = config.get("maxKeyLength", DEFAULT_MAX_KEY_LENGTH)
        clock = config.get("clock")
        if not isinstance(namespace, str) or len(namespace) == 0:
            raise CacheCubeError("INVALID_NAMESPACE", "namespace must be a non-empty string")
        if not isinstance(max_entries, int) or isinstance(max_entries, bool) or max_entries < 1:
            raise CacheCubeError("INVALID_MAX_ENTRIES", "maxEntries must be a safe integer >= 1")
        if not isinstance(max_key_length, int) or isinstance(max_key_length, bool) or max_key_length < 1:
            raise CacheCubeError("INVALID_MAX_KEY_LENGTH", "maxKeyLength must be a safe integer >= 1")
        self.namespace = namespace
        self.maxEntries = max_entries
        self.maxKeyLength = max_key_length
        self.clock = _create_clock(clock)
        self.entries: "Dict[str, Dict[str, Any]]" = {}
        self.inFlight: Dict[str, Dict[str, Any]] = {}
        self.statsValue: Dict[str, int] = {"hits": 0, "misses": 0, "evictions": 0, "sets": 0, "deletes": 0}

    def _full_key(self, key: str) -> str:
        _assert_key(key, self.maxKeyLength)
        return f"{self.namespace}:{key}"

    def _expired(self, entry: Dict[str, Any], now: Optional[float] = None) -> bool:
        if entry.get("expiresAt") is None:
            return False
        now = self.clock.now() if now is None else now
        return now >= entry["expiresAt"]

    def _touch(self, full_key: str, entry: Dict[str, Any]) -> None:
        self.entries.pop(full_key, None)
        self.entries[full_key] = entry

    def _remove_expired(self, full_key: str, entry: Dict[str, Any]) -> bool:
        if not self._expired(entry):
            return False
        self.entries.pop(full_key, None)
        self.statsValue["deletes"] += 1
        return True

    def get(self, key: str) -> Any:
        full_key = self._full_key(key)
        entry = self.entries.get(full_key)
        if entry is None or self._remove_expired(full_key, entry):
            self.statsValue["misses"] += 1
            return None
        self.statsValue["hits"] += 1
        self._touch(full_key, entry)
        return entry["value"]

    def has(self, key: str) -> bool:
        full_key = self._full_key(key)
        entry = self.entries.get(full_key)
        if entry is None or self._remove_expired(full_key, entry):
            return False
        self._touch(full_key, entry)
        return True

    def set(self, key: str, value: Any, options: Optional[Dict[str, Any]] = None) -> Any:
        full_key = self._full_key(key)
        options = options or {}
        ttl = options.get("ttlMs")
        if ttl is not None and (not isinstance(ttl, int) or isinstance(ttl, bool) or ttl <= 0):
            raise CacheCubeError("INVALID_TTL", "ttlMs must be a safe integer > 0")
        now = self.clock.now()
        entry = {
            "value": value,
            "createdAt": now,
            "expiresAt": None if ttl is None else now + ttl,
        }
        self.entries.pop(full_key, None)
        self.entries[full_key] = entry
        self.statsValue["sets"] += 1
        while len(self.entries) > self.maxEntries:
            oldest = next(iter(self.entries))
            self.entries.pop(oldest, None)
            self.statsValue["evictions"] += 1
        return value

    def delete(self, key: str) -> bool:
        full_key = self._full_key(key)
        removed = self.entries.pop(full_key, None) is not None
        if removed:
            self.statsValue["deletes"] += 1
        return removed

    def clear(self) -> int:
        count = len(self.entries)
        self.entries.clear()
        self.statsValue["deletes"] += count
        return count

    def invalidate(self, predicate: Callable[[str, Any], bool]) -> int:
        if not callable(predicate):
            raise CacheCubeError("INVALID_PREDICATE", "predicate must be a function")
        count = 0
        for full_key, entry in list(self.entries.items()):
            key = full_key[len(self.namespace) + 1:]
            if predicate(key, entry["value"]):
                self.entries.pop(full_key, None)
                count += 1
        self.statsValue["deletes"] += count
        return count

    async def getOrCompute(self, key: str, compute: Callable, options: Optional[Dict[str, Any]] = None) -> Any:
        options = options or {}
        full_key = self._full_key(key)
        if not callable(compute):
            raise CacheCubeError("INVALID_COMPUTE", "compute must be a function")

        cached = self.get(key)
        if cached is not None:
            return cached
        if full_key in self.inFlight:
            return await self.inFlight[full_key]["task"]

        cancelled = {"aborted": False, "reason": None}

        async def _run() -> Any:
            try:
                value = await compute()
                if cancelled["aborted"]:
                    raise CacheCubeError("ABORTED", "cache computation aborted")
                self.set(key, value, options)
                return value
            finally:
                self.inFlight.pop(full_key, None)

        task = asyncio.ensure_future(_run())
        self.inFlight[full_key] = {"task": task, "cancel": cancelled}
        try:
            return await task
        except asyncio.CancelledError:
            cancelled["aborted"] = True
            raise

    def stats(self) -> Dict[str, Any]:
        return _freeze_metadata({**self.statsValue, "size": len(self.entries), "inFlight": len(self.inFlight)})

    def snapshot(self) -> Dict[str, Any]:
        return _freeze_metadata({
            "namespace": self.namespace,
            "size": len(self.entries),
            "maxEntries": self.maxEntries,
            **self.statsValue,
        })
