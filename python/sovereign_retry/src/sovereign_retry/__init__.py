"""Native Python implementation of the RETRY1 retry contract (Sovereign Library).

Deterministic retry runner with native backoff, jitter, budgets, timeouts,
and cooperative cancellation.

This is a NATIVE implementation of the contract, not a wrapper around the Node cube.

Guarantees:
- Pure Python standard library only.
- Fixed, linear, and exponential backoff.
- Injectable deterministic randomness for jitter.
- Maximum attempt and total-budget controls.
- Attempt-level timeout with AbortSignal-like propagation.
- Retryability determined by a caller-supplied classifier.
- Immutable attempt history snapshots.
- Deterministic clock injection.
- No coupling to Logger, HTTP, Scheduler, or any third-party library.
"""

from __future__ import annotations

import random
import time
import threading
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Union

__all__ = [
    "RetryError",
    "RetryRunner",
    "create_retry_policy",
    "RealClock",
    "FakeClock",
    "Policy",
]


class RetryError(Exception):
    """Raised when a retry operation fails definitively."""

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
        super().__init__(message, cause)
        self.name = "RetryError"
        self.code = code
        self.attempts = attempts
        self.retryable = retryable
        self.timed_out = timed_out
        self.cancelled = cancelled
        self.last_error = last_error

    def __repr__(self) -> str:
        return (
            f"RetryError(code={self.code!r}, attempts={self.attempts}, "
            f"retryable={self.retryable}, timed_out={self.timed_out}, "
            f"cancelled={self.cancelled}, last_error={self.last_error!r})"
        )


@dataclass(frozen=True)
class Policy:
    """Immutable retry policy configuration."""

    max_attempts: int = 3
    base_delay_ms: int = 100
    backoff: str = "exponential"  # "fixed" | "linear" | "exponential"
    factor: float = 2.0
    max_delay_ms: int = 30_000
    jitter: str = "none"  # "none" | "full" | "bounded"
    random: Callable[[], float] = field(default_factory=lambda: random.random)
    total_budget_ms: Union[int, float] = float("inf")
    retryable: Callable[[BaseException], bool] = field(
        default_factory=lambda: lambda e: getattr(e, "retryable", False) is True
        or getattr(e, "code", None) == "RETRYABLE"
    )

    def __post_init__(self) -> None:
        if not isinstance(self.max_attempts, int) or self.max_attempts < 1:
            raise ValueError("max_attempts must be a safe integer >= 1")
        if not isinstance(self.base_delay_ms, int) or self.base_delay_ms < 0:
            raise ValueError("base_delay_ms must be a safe integer >= 0")
        if not isinstance(self.max_delay_ms, int) or self.max_delay_ms < 0:
            raise ValueError("max_delay_ms must be a safe integer >= 0")
        if not isinstance(self.total_budget_ms, (int, float)) or self.total_budget_ms < 0:
            raise ValueError("total_budget_ms must be a safe integer >= 0 or Infinity")
        if self.backoff not in ("fixed", "linear", "exponential"):
            raise TypeError("backoff must be fixed, linear, or exponential")
        if not isinstance(self.factor, (int, float)) or float(self.factor) < 1:
            raise ValueError("factor must be a finite number >= 1")
        if self.jitter not in ("none", "full", "bounded"):
            raise TypeError("jitter must be none, full, or bounded")
        if not callable(self.random):
            raise TypeError("random must be a function")
        if not callable(self.retryable):
            raise TypeError("retryable must be a function")

    def raw_delay(self, attempt: int) -> float:
        """Calculate raw delay for an attempt (1-indexed)."""
        if self.backoff == "fixed":
            return float(self.base_delay_ms)
        if self.backoff == "linear":
            return float(self.base_delay_ms * attempt)
        # exponential
        return float(self.base_delay_ms * (self.factor ** max(0, attempt - 1)))

    def delay_for(self, attempt: int) -> int:
        """Calculate final delay with jitter and cap applied."""
        capped = min(self.max_delay_ms, self.raw_delay(attempt))
        if self.jitter == "none":
            return max(0, int(round(capped)))
        sample = min(1.0, max(0.0, float(self.random())))
        if self.jitter == "full":
            # round half away from zero to match JS Math.round
            return max(0, int(capped * sample + 0.5))
        # bounded
        return max(0, int(capped / 2 + capped / 2 * sample + 0.5))


def create_retry_policy(**options: Any) -> Policy:
    """Create a new retry policy with the given options."""
    return Policy(**options)


class RealClock:
    """Real-time clock implementation using time.monotonic()."""

    def now(self) -> int:
        return int(time.monotonic() * 1000)

    def set_timeout(self, callback: Callable[[], None], delay_ms: int) -> threading.Timer:
        timer = threading.Timer(delay_ms / 1000.0, callback)
        timer.start()
        return timer

    def clear_timeout(self, timer: Optional[threading.Timer]) -> None:
        if timer is not None:
            timer.cancel()


class FakeClock:
    """Deterministic fake clock for testing."""

    def __init__(self, start_ms: int = 0) -> None:
        if not isinstance(start_ms, int) or start_ms < 0:
            raise ValueError("FakeClock start_ms must be a safe integer >= 0")
        self._time = start_ms
        self._next_id = 1
        self._timers: Dict[int, tuple[Callable[[], None], int]] = {}

    @property
    def timers(self) -> Dict[int, tuple[Callable[[], None], int]]:
        return self._timers

    def now(self) -> int:
        return self._time

    def set_timeout(self, callback: Callable[[], None], delay_ms: int) -> int:
        if not isinstance(delay_ms, int) or delay_ms < 0:
            raise ValueError("FakeClock delay must be a safe integer >= 0")
        timer_id = self._next_id
        self._next_id += 1
        self._timers[timer_id] = (callback, self._time + delay_ms)
        return timer_id

    def clear_timeout(self, timer_id: int) -> None:
        self._timers.pop(timer_id, None)

    def advance(self, ms: int) -> None:
        if not isinstance(ms, int) or ms < 0:
            raise ValueError("FakeClock advance must be a safe integer >= 0")
        self._time += ms
        progressed = True
        while progressed:
            progressed = False
            due = [
                (tid, timer)
                for tid, timer in self._timers.items()
                if timer[1] <= self._time
            ]
            due.sort(key=lambda x: (x[1][1], x[0]))
            for tid, (callback, run_at) in due:
                if tid not in self._timers:
                    continue
                del self._timers[tid]
                callback()
                progressed = True


def _is_abort_error(error: BaseException) -> bool:
    return (
        getattr(error, "name", None) == "AbortError"
        or getattr(error, "code", None) == "ABORT_ERR"
    )


class _SignalMixin:
    """Minimal AbortSignal-like interface for Python."""

    def __init__(self) -> None:
        self._aborted = False
        self._reason: Optional[BaseException] = None
        self._listeners: List[Callable[[], None]] = []

    @property
    def aborted(self) -> bool:
        return self._aborted

    @property
    def reason(self) -> Optional[BaseException]:
        return self._reason

    def add_event_listener(self, callback: Callable[[], None], once: bool = False) -> None:
        self._listeners.append(callback)

    def remove_event_listener(self, callback: Callable[[], None]) -> None:
        try:
            self._listeners.remove(callback)
        except ValueError:
            pass

    def abort(self, reason: Optional[BaseException] = None) -> None:
        if self._aborted:
            return
        self._aborted = True
        self._reason = reason
        for listener in self._listeners[:]:
            try:
                listener()
            except Exception:
                pass


class AbortSignal(_SignalMixin):
    """Python equivalent of DOM AbortSignal for cancellation."""

    pass


class AbortController:
    """Python equivalent of DOM AbortController."""

    def __init__(self) -> None:
        self.signal = AbortSignal()

    def abort(self, reason: Optional[BaseException] = None) -> None:
        self.signal.abort(reason)


@dataclass(frozen=True)
class AttemptSnapshot:
    """Immutable snapshot of a single retry attempt."""

    attempt: int
    ok: bool
    elapsed_ms: int
    error: Optional[BaseException] = None
    retry: bool = False
    delay_ms: Optional[int] = None


@dataclass(frozen=True)
class RunResult:
    """Immutable result of a retry run."""

    value: Any
    attempts: tuple[AttemptSnapshot, ...]
    total_elapsed_ms: int


class RetryRunner:
    """Deterministic retry runner with injected clock and policy."""

    def __init__(self, policy: Policy = None, *, clock: Optional[Any] = None) -> None:
        self.policy = policy or Policy()
        self.clock = clock or RealClock()
        if not hasattr(self.clock, "now") or not callable(self.clock.now):
            raise TypeError("clock must implement now()")
        if not hasattr(self.clock, "set_timeout") or not callable(self.clock.set_timeout):
            raise TypeError("clock must implement set_timeout()")
        if not hasattr(self.clock, "clear_timeout") or not callable(self.clock.clear_timeout):
            raise TypeError("clock must implement clear_timeout()")
        # freeze-like immutability
        object.__setattr__(self, "_frozen", True)

    def __setattr__(self, name: str, value: Any) -> None:
        if getattr(self, "_frozen", False):
            raise AttributeError("RetryRunner is immutable")
        object.__setattr__(self, name, value)

    async def run(
        self,
        operation: Callable[[Dict[str, Any]], Any],
        *,
        signal: Optional[AbortSignal] = None,
        attempt_timeout_ms: Union[int, float] = float("inf"),
    ) -> RunResult:
        if not callable(operation):
            raise TypeError("operation must be a function")
        if not isinstance(attempt_timeout_ms, (int, float)) or attempt_timeout_ms < 0:
                    raise ValueError("attempt_timeout_ms must be a safe integer >= 0 or Infinity")

        started_at = self.clock.now()
        attempts: List[AttemptSnapshot] = []

        for attempt in range(1, self.policy.max_attempts + 1):
            if signal is not None and signal.aborted:
                raise RetryError(
                    "CANCELLED",
                    "retry operation cancelled",
                    attempts=attempt - 1,
                    cancelled=True,
                    cause=signal.reason,
                )

            elapsed_before = max(0, self.clock.now() - started_at)
            if elapsed_before > self.policy.total_budget_ms:
                raise RetryError(
                    "BUDGET_EXCEEDED",
                    "retry total budget exceeded",
                    attempts=attempt - 1,
                    retryable=False,
                )

            attempt_started = self.clock.now()

            try:
                # Run operation with attempt timeout
                value = await self._run_with_attempt_timeout(
                    operation, attempt, attempt_timeout_ms, signal
                )
                attempts.append(
                    AttemptSnapshot(
                        attempt=attempt,
                        ok=True,
                        elapsed_ms=max(0, self.clock.now() - attempt_started),
                    )
                )
                return RunResult(
                    value=value,
                    attempts=tuple(attempts),
                    total_elapsed_ms=max(0, self.clock.now() - started_at),
                )

            except BaseException as error:
                attempts.append(
                    AttemptSnapshot(
                        attempt=attempt,
                        ok=False,
                        elapsed_ms=max(0, self.clock.now() - attempt_started),
                        error=error,
                    )
                )

                if signal is not None and signal.aborted:
                    raise RetryError(
                        "CANCELLED",
                        "retry operation cancelled",
                        attempts=attempt,
                        cancelled=True,
                        cause=signal.reason or error,
                        last_error=error,
                    )

                can_retry = (
                    attempt < self.policy.max_attempts
                    and self.policy.retryable(error)
                )

                if not can_retry:
                    raise RetryError(
                        "RETRY_EXHAUSTED",
                        f"retry failed after {attempt} attempt(s)",
                        attempts=attempt,
                        retryable=False,
                        last_error=error,
                        cause=error,
                    )

                delay_ms = self.policy.delay_for(attempt)
                elapsed_now = max(0, self.clock.now() - started_at)

                if elapsed_now + delay_ms > self.policy.total_budget_ms:
                    raise RetryError(
                        "BUDGET_EXCEEDED",
                        "retry total budget exceeded",
                        attempts=attempt,
                        retryable=False,
                        last_error=error,
                        cause=error,
                    )

                # Update last attempt snapshot with retry info
                attempts[-1] = AttemptSnapshot(
                    attempt=attempts[-1].attempt,
                    ok=False,
                    elapsed_ms=attempts[-1].elapsed_ms,
                    error=attempts[-1].error,
                    retry=True,
                    delay_ms=delay_ms,
                )

                try:
                    await self._delay(delay_ms, signal)
                except BaseException as delay_error:
                    if signal is not None and signal.aborted:
                        raise RetryError(
                            "CANCELLED",
                            "retry operation cancelled",
                            attempts=attempt,
                            cancelled=True,
                            cause=signal.reason or delay_error,
                            last_error=error,
                        )
                    raise

        raise RetryError(
            "RETRY_EXHAUSTED",
            "retry attempts exhausted",
            attempts=self.policy.max_attempts,
        )

    async def _run_with_attempt_timeout(
            self,
            operation: Callable[[Dict[str, Any]], Any],
            attempt: int,
            attempt_timeout_ms: Union[int, float],
            parent_signal: Optional[AbortSignal],
        ) -> Any:
            controller = AbortController()

            # Link parent signal
            parent_listener = None
            if parent_signal is not None:
                def forward() -> None:
                    controller.abort(parent_signal.reason)

                if parent_signal.aborted:
                    controller.abort(parent_signal.reason)
                else:
                    parent_signal.add_event_listener(forward)
                    parent_listener = lambda: parent_signal.remove_event_listener(forward)

            timer = None
            timed_out = False

            try:
                async def work() -> Any:
                    return await operation({"attempt": attempt, "signal": controller.signal})

                if attempt_timeout_ms == float("inf"):
                    return await work()

                # Use injected clock for timeout (matching Node contract)
                import asyncio

                timeout_event = asyncio.Event()

                def on_timeout() -> None:
                    nonlocal timed_out
                    timed_out = True
                    timeout_error = RetryError(
                        "TIMEOUT",
                        f"attempt {attempt} timed out",
                        attempts=attempt,
                        timed_out=True,
                        retryable=True,
                    )
                    controller.abort(timeout_error)
                    timeout_event.set()

                timer = self.clock.set_timeout(on_timeout, int(attempt_timeout_ms))

                # Race operation against timeout
                async def guarded() -> Any:
                    nonlocal timed_out
                    try:
                        operation_task = asyncio.create_task(work())
                        timeout_task = asyncio.create_task(timeout_event.wait())
                        done, pending = await asyncio.wait(
                            [operation_task, timeout_task], return_when=asyncio.FIRST_COMPLETED
                        )
                        for task in pending:
                            task.cancel()
                        if timeout_task in done:
                            # Timeout fired
                            raise RetryError(
                                "TIMEOUT",
                                f"attempt {attempt} timed out",
                                attempts=attempt,
                                timed_out=True,
                                retryable=True,
                            )
                        return operation_task.result()
                    except asyncio.CancelledError:
                        if timed_out:
                            raise RetryError(
                                "TIMEOUT",
                                f"attempt {attempt} timed out",
                                attempts=attempt,
                                timed_out=True,
                                retryable=True,
                            )
                        raise

                return await guarded()

            except BaseException as error:
                if _is_abort_error(error) and parent_signal is not None and parent_signal.aborted:
                    raise
                if parent_signal is not None and parent_signal.aborted:
                    raise parent_signal.reason or error
                if timed_out:
                    raise
                raise
            finally:
                if parent_listener is not None:
                    parent_listener()
                if timer is not None:
                    self.clock.clear_timeout(timer)

    async def _delay(self, ms: int, signal: Optional[AbortSignal]) -> None:
            if ms <= 0:
                return
            if signal is not None and signal.aborted:
                raise signal.reason or RetryError("CANCELLED", "operation aborted")

            import asyncio

            # Create an event that can be triggered by abort or clock
            abort_event = asyncio.Event()

            def on_abort() -> None:
                abort_event.set()

            listener_registered = False
            if signal is not None:
                signal.add_event_listener(on_abort)
                listener_registered = True

            # Use injected clock for delay
            timer = self.clock.set_timeout(lambda: abort_event.set(), ms)

            try:
                await abort_event.wait()
            except asyncio.CancelledError:
                if signal is not None and signal.aborted:
                    raise signal.reason or RetryError("CANCELLED", "operation aborted")
                raise
            finally:
                if listener_registered:
                    signal.remove_event_listener(on_abort)
                self.clock.clear_timeout(timer)