import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_circuit_breaker import CircuitBreaker, CircuitBreakerError, FakeClock


class RetryableError(RuntimeError):
    retryable = True


def run(coro):
    return asyncio.run(coro)


def retryable_failure(_):
    raise RetryableError("temporary")


def test_starts_closed_and_executes_successfully() -> None:
    async def scenario():
        breaker = CircuitBreaker(failure_threshold=2)
        assert breaker.get_state() == "CLOSED"
        assert await breaker.execute(lambda _: "ok") == "ok"
        assert breaker.get_stats()["successes"] == 1

    run(scenario())


def test_opens_after_failure_threshold() -> None:
    async def scenario():
        breaker = CircuitBreaker(failure_threshold=2)
        with pytest.raises(RetryableError):
            await breaker.execute(retryable_failure)
        with pytest.raises(RetryableError):
            await breaker.execute(retryable_failure)
        assert breaker.get_state() == "OPEN"
        with pytest.raises(CircuitBreakerError) as exc:
            await breaker.execute(lambda _: "blocked")
        assert exc.value.code == "OPEN"

    run(scenario())


def test_cooldown_enters_half_open_deterministically() -> None:
    async def scenario():
        clock = FakeClock(0)
        breaker = CircuitBreaker(failure_threshold=1, cooldown_ms=100, clock=clock)
        with pytest.raises(RetryableError):
            await breaker.execute(retryable_failure)
        assert breaker.get_state() == "OPEN"
        clock.advance(99)
        assert breaker.get_state() == "OPEN"
        clock.advance(1)
        assert breaker.get_state() == "HALF_OPEN"

    run(scenario())


def test_half_open_limits_probes_and_success_recovers() -> None:
    async def scenario():
        clock = FakeClock(0)
        breaker = CircuitBreaker(
            failure_threshold=1,
            success_threshold=2,
            cooldown_ms=10,
            half_open_max_probes=1,
            clock=clock,
        )
        with pytest.raises(RetryableError):
            await breaker.execute(retryable_failure)
        clock.advance(10)

        release = asyncio.get_running_loop().create_future()

        async def probe(_):
            return await release

        probe_task = asyncio.create_task(breaker.execute(probe))
        await asyncio.sleep(0)

        with pytest.raises(CircuitBreakerError) as exc:
            await breaker.execute(lambda _: "blocked")
        assert exc.value.code == "PROBE_LIMIT"

        release.set_result("ok")
        assert await probe_task == "ok"
        assert breaker.get_state() == "HALF_OPEN"
        assert await breaker.execute(lambda _: "ok") == "ok"
        assert breaker.get_state() == "CLOSED"

    run(scenario())


def test_half_open_failure_returns_to_open() -> None:
    async def scenario():
        clock = FakeClock(0)
        breaker = CircuitBreaker(failure_threshold=1, cooldown_ms=10, clock=clock)
        with pytest.raises(RetryableError):
            await breaker.execute(retryable_failure)
        clock.advance(10)
        assert breaker.get_state() == "HALF_OPEN"
        with pytest.raises(RetryableError):
            await breaker.execute(retryable_failure)
        assert breaker.get_state() == "OPEN"

    run(scenario())


def test_non_retryable_failures_are_recorded_without_opening() -> None:
    async def scenario():
        breaker = CircuitBreaker(failure_threshold=1)
        with pytest.raises(RuntimeError):
            await breaker.execute(lambda _: (_ for _ in ()).throw(RuntimeError("business")))
        assert breaker.get_state() == "CLOSED"
        assert breaker.get_stats()["failures"] == 1
        assert breaker.get_stats()["failureCount"] == 0

    run(scenario())


def test_manual_reset_closes_open_circuit() -> None:
    async def scenario():
        breaker = CircuitBreaker(failure_threshold=1)
        with pytest.raises(RetryableError):
            await breaker.execute(retryable_failure)
        breaker.reset()
        assert breaker.get_state() == "CLOSED"
        assert breaker.get_stats()["resets"] == 1

    run(scenario())


def test_abort_is_cancelled_without_counting_failure() -> None:
    async def scenario():
        breaker = CircuitBreaker(failure_threshold=1)
        with pytest.raises(CircuitBreakerError) as exc:
            await breaker.execute(lambda _: "never", {"aborted": True, "reason": "stop"})
        assert exc.value.code == "CANCELLED"
        assert breaker.get_state() == "CLOSED"
        assert breaker.get_stats()["failures"] == 0

    run(scenario())


def test_stats_are_immutable_and_close_blocks_new_work() -> None:
    async def scenario():
        breaker = CircuitBreaker()
        snapshot = breaker.get_stats()
        assert snapshot["state"] == "CLOSED"
        with pytest.raises(TypeError):
            snapshot["state"] = "OPEN"  # type: ignore[index]
        breaker.close()
        assert not breaker.can_execute()
        with pytest.raises(CircuitBreakerError) as exc:
            await breaker.execute(lambda _: "blocked")
        assert exc.value.code == "CLOSED"

    run(scenario())


def test_invalid_configuration_fails_early() -> None:
    with pytest.raises(ValueError):
        CircuitBreaker(failure_threshold=0)
    with pytest.raises(ValueError):
        CircuitBreaker(success_threshold=0)
    with pytest.raises(ValueError):
        CircuitBreaker(cooldown_ms=-1)
    with pytest.raises(ValueError):
        CircuitBreaker(half_open_max_probes=0)
    with pytest.raises(TypeError):
        CircuitBreaker(clock=object())
