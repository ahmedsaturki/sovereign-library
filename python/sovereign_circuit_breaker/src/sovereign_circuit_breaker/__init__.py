"""Native, dependency-free Python implementation of the Sovereign Circuit Breaker contract."""

from __future__ import annotations

import inspect
import time
from types import MappingProxyType
from typing import Any, Callable, Dict, Mapping, Optional

__all__ = ["CircuitBreakerError", "FakeClock", "CircuitBreaker"]


class CircuitBreakerError(RuntimeError):
    """Typed circuit-breaker control error."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        probe: bool = False,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(message)
        self.name = "CircuitBreakerError"
        self.code = code
        self.retryable = retryable
        self.probe = probe
        self.cause = cause


class FakeClock:
    """Deterministic clock for contract tests."""

    def __init__(self, start_ms: int = 0) -> None:
        if isinstance(start_ms, bool) or not isinstance(start_ms, int) or start_ms < 0:
            raise ValueError("start_ms must be a safe integer >= 0")
        self._time = start_ms

    def now(self) -> int:
        return self._time

    def advance(self, ms: int) -> int:
        if isinstance(ms, bool) or not isinstance(ms, int) or ms < 0:
            raise ValueError("ms must be a safe integer >= 0")
        self._time += ms
        return self._time


class _SystemClock:
    @staticmethod
    def now() -> int:
        return int(time.time() * 1000)


class CircuitBreaker:
    """Async circuit breaker with CLOSED/OPEN/HALF_OPEN states."""

    def __init__(
        self,
        *,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        cooldown_ms: int = 30_000,
        half_open_max_probes: int = 1,
        clock: Optional[Any] = None,
        is_failure: Optional[Callable[[BaseException], bool]] = None,
    ) -> None:
        self._validate_positive_int(failure_threshold, "failure_threshold")
        self._validate_positive_int(success_threshold, "success_threshold")
        self._validate_nonnegative_int(cooldown_ms, "cooldown_ms")
        self._validate_positive_int(half_open_max_probes, "half_open_max_probes")
        if clock is None:
            clock = _SystemClock()
        if not hasattr(clock, "now") or not callable(clock.now):
            raise TypeError("clock must implement now()")
        if is_failure is not None and not callable(is_failure):
            raise TypeError("is_failure must be a function")

        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.cooldown_ms = cooldown_ms
        self.half_open_max_probes = half_open_max_probes
        self.clock = clock
        self.is_failure = is_failure or self._default_is_failure

        self.state = "CLOSED"
        self.failures = 0
        self.successes = 0
        self.opened_at: Optional[int] = None
        self.probes = 0
        self.lifecycle_closed = False
        self._stats: Dict[str, int] = {
            "calls": 0,
            "successes": 0,
            "failures": 0,
            "rejections": 0,
            "opens": 0,
            "halfOpen": 0,
            "resets": 0,
        }

    @staticmethod
    def _validate_positive_int(value: Any, name: str) -> None:
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise ValueError(f"{name} must be a safe integer >= 1")

    @staticmethod
    def _validate_nonnegative_int(value: Any, name: str) -> None:
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError(f"{name} must be a safe integer >= 0")

    @staticmethod
    def _default_is_failure(error: BaseException) -> bool:
        return bool(
            getattr(error, "retryable", False)
            or getattr(error, "code", None) in {"RETRYABLE", "TIMEOUT"}
        )

    def get_state(self) -> str:
        if self.lifecycle_closed:
            return "CLOSED"
        if self.state == "OPEN" and self.clock.now() - int(self.opened_at or 0) >= self.cooldown_ms:
            self._enter_half_open()
        return self.state

    def get_stats(self) -> Mapping[str, Any]:
        self.get_state()
        snapshot: Dict[str, Any] = {
            "state": self.state,
            "failureCount": self.failures,
            "successCount": self.successes,
            "probes": self.probes,
            "openedAt": self.opened_at,
            "cooldownMs": self.cooldown_ms,
            "failureThreshold": self.failure_threshold,
            "successThreshold": self.success_threshold,
            "halfOpenMaxProbes": self.half_open_max_probes,
            "closed": self.lifecycle_closed,
        }
        snapshot.update(self._stats)
        return MappingProxyType(snapshot)

    def can_execute(self) -> bool:
        if self.lifecycle_closed:
            return False
        state = self.get_state()
        if state == "CLOSED":
            return True
        if state == "OPEN":
            return False
        return self.probes < self.half_open_max_probes

    def reset(self) -> None:
        if self.lifecycle_closed:
            return
        self._set_closed()
        self._stats["resets"] += 1

    def close(self) -> None:
        self.lifecycle_closed = True

    async def execute(self, operation: Callable[[Mapping[str, Any]], Any], options: Optional[Mapping[str, Any]] = None) -> Any:
        if not callable(operation):
            raise TypeError("operation must be callable")
        options = options or {}
        if self.lifecycle_closed:
            raise CircuitBreakerError("CLOSED", "Circuit breaker is closed for new operations")

        state = self.get_state()
        if state == "OPEN":
            self._stats["rejections"] += 1
            raise CircuitBreakerError("OPEN", "Circuit breaker is open", retryable=True)

        if state == "HALF_OPEN":
            if self.probes >= self.half_open_max_probes:
                self._stats["rejections"] += 1
                raise CircuitBreakerError(
                    "PROBE_LIMIT",
                    "Half-open probe limit reached",
                    retryable=True,
                    probe=True,
                )
            self.probes += 1

        if bool(options.get("aborted", False)):
            if state == "HALF_OPEN":
                self.probes = max(0, self.probes - 1)
            raise CircuitBreakerError(
                "CANCELLED",
                "Circuit breaker operation cancelled",
                probe=state == "HALF_OPEN",
                cause=options.get("reason"),
            )

        self._stats["calls"] += 1
        context = {"state": state, "signal": options.get("signal")}
        try:
            result = operation(context)
            if inspect.isawaitable(result):
                result = await result
            self._record_success(state)
            return result
        except BaseException as error:
            self._record_failure(state, error)
            raise

    def _record_success(self, state: str) -> None:
        self._stats["successes"] += 1
        if state == "HALF_OPEN":
            self.probes = max(0, self.probes - 1)
            self.successes += 1
            if self.successes >= self.success_threshold:
                self._set_closed()
            return
        self.failures = 0

    def _record_failure(self, state: str, error: BaseException) -> None:
        self._stats["failures"] += 1
        if not self.is_failure(error):
            return
        if state == "HALF_OPEN":
            self.probes = max(0, self.probes - 1)
            self._set_open()
            return
        self.failures += 1
        if self.failures >= self.failure_threshold:
            self._set_open()

    def _enter_half_open(self) -> None:
        if self.state != "OPEN":
            return
        self.state = "HALF_OPEN"
        self.successes = 0
        self.probes = 0
        self._stats["halfOpen"] += 1

    def _set_open(self) -> None:
        if self.state != "OPEN":
            self._stats["opens"] += 1
        self.state = "OPEN"
        self.opened_at = int(self.clock.now())
        self.successes = 0
        self.probes = 0

    def _set_closed(self) -> None:
        self.state = "CLOSED"
        self.failures = 0
        self.successes = 0
        self.opened_at = None
        self.probes = 0
