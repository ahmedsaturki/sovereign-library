"""Native, dependency-free Python implementation of the Sovereign Retry contract."""

from __future__ import annotations

import asyncio
import math
import random as _random
import time
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Awaitable, Callable, Mapping, Optional

__all__ = [
    "RetryError",
    "FakeClock",
    "RealClock",
    "create_retry_policy",
    "RetryRunner",
]


class RetryError(RuntimeError):
    """Deterministic typed error raised by retry control logic."""

    __slots__ = (
        "name",
        "code",
        "attempts",
        "retryable",
        "timed_out",
        "cancelled",
        "last_error",
        "cause",
        "_frozen",
    )

    def __init__(
        self,
        code: str,
        message: str,
        *,
        attempts: int = 0,
        retryable: bool = False,
        timed_out: bool = False,
        cancelled: bool = False,
        last_error: Optional[BaseException] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(message)
        object.__setattr__(self, "name", "RetryError")
        object.__setattr__(self, "code", code)
        object.__setattr__(self, "attempts", attempts)
        object.__setattr__(self, "retryable", retryable)
        object.__setattr__(self, "timed_out", timed_out)
        object.__setattr__(self, "cancelled", cancelled)
        object.__setattr__(self, "last_error", last_error)
        object.__setattr__(self, "cause", cause)
        object.__setattr__(self, "_frozen", True)

    def __setattr__(self, name: str, value: Any) -> None:
        if getattr(self, "_frozen", False):
            raise AttributeError(f"{self.__class__.__name__} is immutable")
        object.__setattr__(self, name, value)


@dataclass(frozen=True)
class _Timer:
    token: int
    due_ms: int
    callback: Callable[[], None]


class FakeClock:
    """Deterministic clock with cancellable timers for retry tests."""

    def __init__(self, start_ms: int = 0) -> None:
        _validate_nonnegative_int(start_ms, "start_ms")
        self._time = start_ms
        self._next_token = 1
        self._timers: dict[int, _Timer] = {}

    def now(self) -> int:
        return self._time

    @property
    def timers(self) -> Mapping[int, _Timer]:
        return MappingProxyType(dict(self._timers))

    def set_timeout(self, callback: Callable[[], None], ms: int) -> int:
        _validate_nonnegative_int(ms, "ms")
        if not callable(callback):
            raise TypeError("callback must be callable")
        token = self._next_token
        self._next_token += 1
        self._timers[token] = _Timer(token, self._time + ms, callback)
        if ms == 0:
            self._run_due()
        return token

    def clear_timeout(self, token: int) -> None:
        self._timers.pop(token, None)

    def advance(self, ms: int) -> int:
        _validate_nonnegative_int(ms, "ms")
        self._time += ms
        self._run_due()
        return self._time

    def _run_due(self) -> None:
        while True:
            due = [timer for timer in self._timers.values() if timer.due_ms <= self._time]
            if not due:
                return
            due.sort(key=lambda timer: (timer.due_ms, timer.token))
            for timer in due:
                self._timers.pop(timer.token, None)
                timer.callback()


class RealClock:
    """Wall-clock timer adapter used by RetryRunner in production."""

    def now(self) -> int:
        return int(time.time() * 1000)

    def set_timeout(self, callback: Callable[[], None], ms: int) -> asyncio.TimerHandle:
        _validate_nonnegative_int(ms, "ms")
        if not callable(callback):
            raise TypeError("callback must be callable")
        loop = asyncio.get_running_loop()
        return loop.call_later(ms / 1000.0, callback)

    def clear_timeout(self, token: asyncio.TimerHandle) -> None:
        token.cancel()


def _validate_nonnegative_int(value: Any, name: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{name} must be a safe integer >= 0")


def _validate_safe_integer_or_infinity(value: Any, name: str, minimum: int = 0) -> None:
    if value is math.inf:
        return
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"{name} must be a safe integer >= {minimum} or Infinity")


def _round_js(value: float) -> int:
    if value < 0:
        return math.floor(value + 0.5)
    return math.floor(value + 0.5)


def create_retry_policy(
    *,
    max_attempts: int = 3,
    base_delay_ms: int = 100,
    backoff: str = "exponential",
    factor: float = 2,
    max_delay_ms: int = 30_000,
    jitter: str = "none",
    random_source: Optional[Callable[[], float]] = None,
    total_budget_ms: float = math.inf,
    retryable: Optional[Callable[[BaseException], bool]] = None,
) -> Mapping[str, Any]:
    _validate_safe_integer_or_infinity(max_attempts, "max_attempts", 1)
    _validate_safe_integer_or_infinity(base_delay_ms, "base_delay_ms", 0)
    _validate_safe_integer_or_infinity(max_delay_ms, "max_delay_ms", 0)
    _validate_safe_integer_or_infinity(total_budget_ms, "total_budget_ms", 0)
    if backoff not in {"fixed", "linear", "exponential"}:
        raise TypeError("backoff must be fixed, linear, or exponential")
    if not isinstance(factor, (int, float)) or isinstance(factor, bool) or not math.isfinite(factor) or factor < 1:
        raise ValueError("factor must be a finite number >= 1")
    if jitter not in {"none", "full", "bounded"}:
        raise TypeError("jitter must be none, full, or bounded")
    if random_source is not None and not callable(random_source):
        raise TypeError("random must be a function")
    if retryable is not None and not callable(retryable):
        raise TypeError("retryable must be a function")

    rand = random_source or _random.random
    predicate = retryable or (lambda error: bool(getattr(error, "retryable", False) or getattr(error, "code", None) == "RETRYABLE"))

    def raw_delay(attempt: int) -> float:
        if backoff == "fixed":
            return float(base_delay_ms)
        if backoff == "linear":
            return float(base_delay_ms * attempt)
        return float(base_delay_ms * (float(factor) ** max(0, attempt - 1)))

    def delay_for(attempt: int) -> int:
        capped = min(float(max_delay_ms), raw_delay(attempt))
        if jitter == "none":
            return max(0, _round_js(capped))
        sample = min(1.0, max(0.0, float(rand())))
        if jitter == "full":
            return max(0, _round_js(capped * sample))
        return max(0, _round_js(capped / 2.0 + (capped / 2.0) * sample))

    return MappingProxyType(
        {
            "maxAttempts": max_attempts,
            "baseDelayMs": base_delay_ms,
            "backoff": backoff,
            "factor": factor,
            "maxDelayMs": max_delay_ms,
            "jitter": jitter,
            "totalBudgetMs": total_budget_ms,
            "retryable": predicate,
            "delay_for": delay_for,
        }
    )


async def _sleep(clock: Any, ms: int, cancel_event: Optional[asyncio.Event]) -> None:
    if ms <= 0:
        return
    if cancel_event is not None and cancel_event.is_set():
        raise asyncio.CancelledError

    loop = asyncio.get_running_loop()
    future: asyncio.Future[None] = loop.create_future()
    timer = clock.set_timeout(lambda: (not future.done()) and future.set_result(None), ms)

    waiter: Optional[asyncio.Task[bool]] = None
    try:
        if cancel_event is None:
            await future
            return
        waiter = asyncio.create_task(cancel_event.wait())
        done, _ = await asyncio.wait({future, waiter}, return_when=asyncio.FIRST_COMPLETED)
        if waiter in done and cancel_event.is_set():
            raise asyncio.CancelledError
    finally:
        if waiter is not None:
            waiter.cancel()
        clock.clear_timeout(timer)


async def _run_with_attempt_timeout(
    operation: Callable[[Mapping[str, Any]], Any],
    attempt: int,
    attempt_timeout_ms: float,
    parent_cancel: Optional[asyncio.Event],
) -> Any:
    attempt_cancel = asyncio.Event()
    task = asyncio.create_task(_maybe_await(operation({"attempt": attempt, "signal": attempt_cancel})))
    parent_task: Optional[asyncio.Task[bool]] = None
    try:
        if parent_cancel is not None and parent_cancel.is_set():
            attempt_cancel.set()
            raise RetryError("CANCELLED", "retry operation cancelled", attempts=attempt - 1, cancelled=True)
        if parent_cancel is not None:
            parent_task = asyncio.create_task(parent_cancel.wait())
        timeout = None if attempt_timeout_ms is math.inf else attempt_timeout_ms / 1000.0
        wait_set: set[asyncio.Task[Any] | asyncio.Future[Any]] = {task}
        if parent_task is not None:
            wait_set.add(parent_task)
        done, _ = await asyncio.wait(wait_set, timeout=timeout, return_when=asyncio.FIRST_COMPLETED)
        if not done:
            attempt_cancel.set()
            task.cancel()
            raise RetryError(
                "TIMEOUT",
                f"attempt {attempt} timed out",
                attempts=attempt,
                retryable=True,
                timed_out=True,
            )
        if parent_task is not None and parent_task in done and parent_cancel is not None and parent_cancel.is_set():
            attempt_cancel.set()
            task.cancel()
            raise RetryError("CANCELLED", "retry operation cancelled", attempts=attempt, cancelled=True)
        return await task
    finally:
        if parent_task is not None:
            parent_task.cancel()


async def _maybe_await(value: Any) -> Any:
    if isinstance(value, Awaitable):
        return await value
    return value


class RetryRunner:
    """Retry executor with deterministic backoff, budgets, timeout, and cancellation."""

    __slots__ = ("policy", "clock")

    def __init__(self, policy: Optional[Mapping[str, Any]] = None, *, clock: Optional[Any] = None) -> None:
        self.policy = policy or create_retry_policy()
        self.clock = clock or RealClock()
        if not hasattr(self.clock, "now") or not hasattr(self.clock, "set_timeout") or not hasattr(self.clock, "clear_timeout"):
            raise TypeError("clock must implement now(), set_timeout(), clear_timeout()")

    async def run(
        self,
        operation: Callable[[Mapping[str, Any]], Any],
        *,
        signal: Optional[asyncio.Event] = None,
        attempt_timeout_ms: float = math.inf,
    ) -> Mapping[str, Any]:
        if not callable(operation):
            raise TypeError("operation must be a function")
        _validate_safe_integer_or_infinity(attempt_timeout_ms, "attempt_timeout_ms", 0)
        started_at = self.clock.now()
        attempts: list[Mapping[str, Any]] = []
        max_attempts = self.policy["maxAttempts"]
        attempt = 1
        while max_attempts is math.inf or attempt <= max_attempts:
            if signal is not None and signal.is_set():
                raise RetryError("CANCELLED", "retry operation cancelled", attempts=attempt - 1, cancelled=True)
            elapsed_before = max(0, self.clock.now() - started_at)
            if elapsed_before > self.policy["totalBudgetMs"]:
                raise RetryError("BUDGET_EXCEEDED", "retry total budget exceeded", attempts=attempt - 1)

            attempt_started = self.clock.now()
            try:
                value = await _run_with_attempt_timeout(operation, attempt, attempt_timeout_ms, signal)
                attempts.append(MappingProxyType({"attempt": attempt, "ok": True, "elapsedMs": max(0, self.clock.now() - attempt_started)}))
                return MappingProxyType(
                    {
                        "value": value,
                        "attempts": tuple(attempts),
                        "totalElapsedMs": max(0, self.clock.now() - started_at),
                    }
                )
            except RetryError as error:
                if error.code == "CANCELLED":
                    attempts.append(MappingProxyType({"attempt": attempt, "ok": False, "error": error, "elapsedMs": max(0, self.clock.now() - attempt_started)}))
                    raise
                if error.code == "TIMEOUT":
                    cause: BaseException = error
                else:
                    cause = error
            except BaseException as error:
                cause = error

            attempts.append(MappingProxyType({"attempt": attempt, "ok": False, "error": cause, "elapsedMs": max(0, self.clock.now() - attempt_started)}))
            if signal is not None and signal.is_set():
                raise RetryError("CANCELLED", "retry operation cancelled", attempts=attempt, cancelled=True, cause=signal, last_error=cause)

            can_retry = (max_attempts is math.inf or attempt < max_attempts) and bool(self.policy["retryable"](cause))
            if not can_retry:
                raise RetryError(
                    "RETRY_EXHAUSTED",
                    f"retry failed after {attempt} attempt(s)",
                    attempts=attempt,
                    retryable=False,
                    last_error=cause,
                    cause=cause,
                )

            delay_ms = int(self.policy["delay_for"](attempt))
            elapsed_now = max(0, self.clock.now() - started_at)
            if elapsed_now + delay_ms > self.policy["totalBudgetMs"]:
                raise RetryError(
                    "BUDGET_EXCEEDED",
                    "retry total budget exceeded",
                    attempts=attempt,
                    last_error=cause,
                    cause=cause,
                )
            attempts[-1] = MappingProxyType({**dict(attempts[-1]), "retry": True, "delayMs": delay_ms})
            try:
                await _sleep(self.clock, delay_ms, signal)
            except asyncio.CancelledError as delay_error:
                raise RetryError(
                    "CANCELLED",
                    "retry operation cancelled",
                    attempts=attempt,
                    cancelled=True,
                    cause=delay_error,
                    last_error=cause,
                ) from delay_error
            attempt += 1

        raise RetryError("RETRY_EXHAUSTED", "retry attempts exhausted", attempts=max_attempts)
