"""Native tests for the RETRY1 retry Python port (contract-grounded)."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_retry import (
    AbortController,
    AbortSignal,
    FakeClock,
    RealClock,
    RetryError,
    RetryRunner,
    create_retry_policy,
)


async def flush_microtasks(rounds: int = 8) -> None:
    for _ in range(rounds):
        await asyncio.sleep(0)


def test_fixed_and_exponential_policies_compute_deterministic_delays() -> None:
    fixed = create_retry_policy(backoff="fixed", base_delay_ms=100)
    exp = create_retry_policy(backoff="exponential", base_delay_ms=100, factor=2)

    assert fixed.delay_for(3) == 100
    assert exp.delay_for(1) == 100
    assert exp.delay_for(2) == 200
    assert exp.delay_for(3) == 400


def test_jitter_is_deterministic_when_random_source_is_injected() -> None:
    full = create_retry_policy(base_delay_ms=100, jitter="full", random=lambda: 0.25)
    bounded = create_retry_policy(base_delay_ms=100, jitter="bounded", random=lambda: 0.25)

    assert full.delay_for(1) == 25
    assert bounded.delay_for(1) == 63


async def test_retry_runner_retries_retryable_failures_and_returns_attempt_history() -> None:
    clock = FakeClock(0)
    runner = RetryRunner(create_retry_policy(max_attempts=3, base_delay_ms=100), clock=clock)
    count = 0

    async def operation(ctx):
        nonlocal count
        count += 1
        if count < 3:
            class TempError(Exception):
                retryable = True

            raise TempError("temporary")
        assert ctx["signal"].aborted is False
        return "ok"

    task = asyncio.create_task(runner.run(operation))
    await flush_microtasks()
    clock.advance(100)
    await flush_microtasks()
    clock.advance(200)
    await flush_microtasks()
    result = await task

    assert result.value == "ok"
    assert len(result.attempts) == 3
    assert result.attempts[0].retry is True
    assert result.attempts[1].delay_ms == 200


async def test_non_retryable_errors_stop_immediately() -> None:
    runner = RetryRunner(create_retry_policy(max_attempts=5), clock=FakeClock(0))

    async def operation(_):
        raise Exception("fatal")

    with pytest.raises(RetryError) as exc_info:
        await runner.run(operation)

    assert exc_info.value.code == "RETRY_EXHAUSTED"
    assert exc_info.value.attempts == 1
    assert exc_info.value.retryable is False


async def test_attempt_timeout_aborts_the_attempt_and_is_retryable_by_default() -> None:
    clock = FakeClock(0)
    runner = RetryRunner(create_retry_policy(max_attempts=2, base_delay_ms=50), clock=clock)

    async def operation(_):
        await asyncio.Event().wait()

    task = asyncio.create_task(runner.run(operation, attempt_timeout_ms=100))
    await flush_microtasks()
    clock.advance(100)
    await flush_microtasks()
    clock.advance(50)
    await flush_microtasks()
    clock.advance(100)
    await flush_microtasks()

    with pytest.raises(RetryError) as exc_info:
        await task

    assert exc_info.value.code == "RETRY_EXHAUSTED"
    assert exc_info.value.attempts == 2


async def test_abort_signal_cancels_during_backoff_and_cleans_the_timer() -> None:
    clock = FakeClock(0)
    runner = RetryRunner(create_retry_policy(max_attempts=3, base_delay_ms=100), clock=clock)
    controller = AbortController()

    async def operation(_):
        class TempError(Exception):
            retryable = True

        raise TempError("temporary")

    task = asyncio.create_task(runner.run(operation, signal=controller.signal))
    await flush_microtasks()
    controller.abort(Exception("stop"))

    with pytest.raises(RetryError) as exc_info:
        await task

    assert exc_info.value.code == "CANCELLED"
    assert exc_info.value.cancelled is True
    assert len(clock.timers) == 0


async def test_total_budget_prevents_a_retry_that_would_exceed_the_budget() -> None:
    clock = FakeClock(0)
    runner = RetryRunner(
        create_retry_policy(max_attempts=5, base_delay_ms=100, total_budget_ms=50),
        clock=clock,
    )

    async def operation(_):
        class TempError(Exception):
            retryable = True

        raise TempError("temporary")

    task = asyncio.create_task(runner.run(operation))
    await flush_microtasks()

    with pytest.raises(RetryError) as exc_info:
        await task

    assert exc_info.value.code == "BUDGET_EXCEEDED"


def test_policy_validation_rejects_invalid_configuration() -> None:
    with pytest.raises((ValueError, TypeError)):
        create_retry_policy(max_attempts=0)
    with pytest.raises(TypeError):
        create_retry_policy(backoff="unknown")
    with pytest.raises((ValueError, TypeError)):
        create_retry_policy(factor=0)
    with pytest.raises(TypeError):
        create_retry_policy(jitter="unknown")


def test_linear_backoff_computes_correct_delays() -> None:
    linear = create_retry_policy(backoff="linear", base_delay_ms=50)
    assert linear.delay_for(1) == 50
    assert linear.delay_for(2) == 100
    assert linear.delay_for(3) == 150


def test_max_delay_caps_exponential_backoff() -> None:
    policy = create_retry_policy(backoff="exponential", base_delay_ms=100, factor=2, max_delay_ms=150)
    assert policy.delay_for(1) == 100
    assert policy.delay_for(2) == 150
    assert policy.delay_for(3) == 150


def test_retry_error_attributes() -> None:
    error = RetryError(
        "TEST_CODE",
        "test message",
        attempts=3,
        retryable=True,
        timed_out=False,
        cancelled=False,
        last_error=Exception("original"),
    )

    assert error.code == "TEST_CODE"
    assert error.attempts == 3
    assert error.retryable is True
    assert error.timed_out is False
    assert error.cancelled is False
    assert error.last_error is not None


async def test_custom_retryable_classifier() -> None:
    def custom_retryable(error: BaseException) -> bool:
        return isinstance(error, ValueError)

    policy = create_retry_policy(max_attempts=2, retryable=custom_retryable)
    runner = RetryRunner(policy, clock=FakeClock(0))

    async def operation_retryable(_):
        raise ValueError("retry me")

    async def operation_non_retryable(_):
        raise TypeError("fatal")

    with pytest.raises(RetryError) as retry_exc:
        await runner.run(operation_retryable)
    assert retry_exc.value.code == "RETRY_EXHAUSTED"
    assert retry_exc.value.attempts == 2

    with pytest.raises(RetryError) as fatal_exc:
        await runner.run(operation_non_retryable)
    assert fatal_exc.value.code == "RETRY_EXHAUSTED"
    assert fatal_exc.value.attempts == 1


async def test_real_clock_works() -> None:
    clock = RealClock()
    now = clock.now()
    assert isinstance(now, int)
    assert now >= 0


def test_fake_clock_advance_clears_timers_in_order() -> None:
    clock = FakeClock(0)
    results = []

    clock.set_timeout(lambda: results.append("first"), 200)
    clock.set_timeout(lambda: results.append("second"), 100)

    clock.advance(50)
    assert results == []
    clock.advance(50)
    assert results == ["second"]
    clock.advance(100)
    assert results == ["second", "first"]


async def test_runner_immutable_after_creation() -> None:
    runner = RetryRunner(create_retry_policy(), clock=FakeClock(0))
    with pytest.raises(AttributeError):
        runner.policy = create_retry_policy(max_attempts=10)


async def test_max_delay_ms_with_jitter() -> None:
    policy = create_retry_policy(
        backoff="exponential",
        base_delay_ms=100,
        factor=2,
        max_delay_ms=150,
        jitter="full",
        random=lambda: 0.5,
    )
    assert policy.delay_for(2) == 75


async def test_fake_clock_negative_values_rejected() -> None:
    with pytest.raises(ValueError):
        FakeClock(-1)

    clock = FakeClock(0)
    with pytest.raises(ValueError):
        clock.advance(-1)
    with pytest.raises(ValueError):
        clock.set_timeout(lambda: None, -1)


async def test_retry_runner_operation_must_be_callable() -> None:
    runner = RetryRunner(clock=FakeClock(0))
    with pytest.raises(TypeError):
        await runner.run("not a function")


async def test_attempt_timeout_validation_rejects_invalid_values() -> None:
    runner = RetryRunner(clock=FakeClock(0))
    async def operation(_):
        return "ok"

    with pytest.raises(ValueError):
        await runner.run(operation, attempt_timeout_ms=-1)
    with pytest.raises(ValueError):
        await runner.run(operation, attempt_timeout_ms="100")


async def test_abort_controller_basic() -> None:
    controller = AbortController()
    assert controller.signal.aborted is False
    controller.abort(Exception("test"))
    assert controller.signal.aborted is True
    assert isinstance(controller.signal.reason, Exception)


async def test_abort_signal_listeners() -> None:
    signal = AbortSignal()
    called = []

    def listener():
        called.append(True)

    signal.add_event_listener(listener)
    signal.abort(Exception("test"))
    assert len(called) == 1

    called.clear()
    signal.remove_event_listener(listener)
    assert len(called) == 0


if __name__ == "__main__":
    import pytest

    raise SystemExit(pytest.main([__file__, "-q"]))
