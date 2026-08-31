import asyncio

import pytest

from sovereign_circuit_breaker import CircuitBreaker, CircuitBreakerError, FakeClock


class RetryableError(RuntimeError):
    retryable = True


@pytest.mark.asyncio
async def test_starts_closed_and_executes_successfully() -> None:
    breaker = CircuitBreaker(failure_threshold=2)
    assert breaker.get_state() == "CLOSED"
    assert await breaker.execute(lambda _: "ok") == "ok"
    assert breaker.get_stats()["successes"] == 1


@pytest.mark.asyncio
async def test_opens_after_failure_threshold() -> None:
    breaker = CircuitBreaker(failure_threshold=2)
    await asyncio.gather(
        breaker.execute(lambda _: (_ for _ in ()).throw(RetryableError("temporary"))),
        breaker.execute(lambda _: (_ for _ in ()).throw(RetryableError("temporary"))),
        return_exceptions=True,
    )
    assert breaker.get_state() == "OPEN"
    with pytest.raises(CircuitBreakerError, match="Circuit breaker is open"):
        await breaker.execute(lambda _: "blocked")


@pytest.mark.asyncio
async def test_cooldown_enters_half_open_deterministically() -> None:
    clock = FakeClock(0)
    breaker = CircuitBreaker(failure_threshold=1, cooldown_ms=100, clock=clock)
    with pytest.raises(RetryableError):
        await breaker.execute(lambda _: (_ for _ in ()).throw(RetryableError("temporary")))
    assert breaker.get_state() == "OPEN"
    clock.advance(99)
    assert breaker.get_state() == "OPEN"
    clock.advance(1)
    assert breaker.get_state() == "HALF_OPEN"


@pytest.mark.asyncio
async def test_half_open_limits_probes_and_success_recovers() -> None:
    clock = FakeClock(0)
    breaker = CircuitBreaker(
        failure_threshold=1,
        success_threshold=2,
        cooldown_ms=10,
        half_open_max_probes=1,
        clock=clock,
    )
    with pytest.raises(RetryableError):
        await breaker.execute(lambda _: (_ for _ in ()).throw(RetryableError("temporary")))
    clock.advance(10)

    release: asyncio.Future[str] = asyncio.get_running_loop().create_future()

    async def probe(_: object) -> str:
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


@pytest.mark.asyncio
async def test_half_open_failure_returns_to_open() -> None:
    clock = FakeClock(0)
    breaker = CircuitBreaker(failure_threshold=1, cooldown_ms=10, clock=clock)
    with pytest.raises(RetryableError):
        await breaker.execute(lambda _: (_ for _ in ()).throw(RetryableError("temporary")))
    clock.advance(10)
    assert breaker.get_state() == "HALF_OPEN"
    with pytest.raises(RetryableError):
        await breaker.execute(lambda _: (_ for _ in ()).throw(RetryableError("temporary")))
    assert breaker.get_state() == "OPEN"


@pytest.mark.asyncio
async def test_non_retryable_failures_are_recorded_without_opening() -> None:
    breaker = CircuitBreaker(failure_threshold=1)
    with pytest.raises(RuntimeError):
        await breaker.execute(lambda _: (_ for _ in ()).throw(RuntimeError("business")))
    assert breaker.get_state() == "CLOSED"
    assert breaker.get_stats()["failures"] == 1
    assert breaker.get_stats()["failureCount"] == 0


@pytest.mark.asyncio
async def test_manual_reset_closes_open_circuit() -> None:
    breaker = CircuitBreaker(failure_threshold=1)
    with pytest.raises(RetryableError):
        await breaker.execute(lambda _: (_ for _ in ()).throw(RetryableError("temporary")))
    breaker.reset()
    assert breaker.get_state() == "CLOSED"
    assert breaker.get_stats()["resets"] == 1


@pytest.mark.asyncio
async def test_abort_is_cancelled_without_counting_failure() -> None:
    breaker = CircuitBreaker(failure_threshold=1)
    with pytest.raises(CircuitBreakerError) as exc:
        await breaker.execute(lambda _: "never", {"aborted": True, "reason": "stop"})
    assert exc.value.code == "CANCELLED"
    assert breaker.get_state() == "CLOSED"
    assert breaker.get_stats()["failures"] == 0


@pytest.mark.asyncio
async def test_stats_are_immutable_and_close_blocks_new_work() -> None:
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
