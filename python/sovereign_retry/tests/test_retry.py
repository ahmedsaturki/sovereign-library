import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_retry import FakeClock, RetryError, RetryRunner, create_retry_policy


class RetryableError(RuntimeError):
    retryable = True


def run(coro):
    return asyncio.run(coro)


def flush(rounds=8):
    async def _flush():
        for _ in range(rounds):
            await asyncio.sleep(0)

    run(_flush())


def test_fixed_and_exponential_policies_are_deterministic():
    fixed = create_retry_policy(backoff="fixed", base_delay_ms=100)
    exp = create_retry_policy(backoff="exponential", base_delay_ms=100, factor=2)
    assert fixed["delay_for"](3) == 100
    assert exp["delay_for"](1) == 100
    assert exp["delay_for"](2) == 200
    assert exp["delay_for"](3) == 400


def test_jitter_is_deterministic_with_injected_random_source():
    full = create_retry_policy(base_delay_ms=100, jitter="full", random_source=lambda: 0.25)
    bounded = create_retry_policy(base_delay_ms=100, jitter="bounded", random_source=lambda: 0.25)
    assert full["delay_for"](1) == 25
    assert bounded["delay_for"](1) == 63


def test_retry_runner_retries_retryable_failures_and_returns_history():
    async def scenario():
        clock = FakeClock(0)
        runner = RetryRunner(
            create_retry_policy(max_attempts=3, base_delay_ms=100),
            clock=clock,
        )
        count = 0

        async def operation(_):
            nonlocal count
            count += 1
            if count < 3:
                raise RetryableError("temporary")
            return "ok"

        promise = asyncio.create_task(runner.run(operation))
        await asyncio.sleep(0)
        clock.advance(100)
        await asyncio.sleep(0)
        clock.advance(200)
        await asyncio.sleep(0)
        result = await promise
        assert result["value"] == "ok"
        assert len(result["attempts"]) == 3
        assert result["attempts"][0]["retry"] is True
        assert result["attempts"][1]["delayMs"] == 200

    run(scenario())


def test_non_retryable_errors_stop_immediately():
    async def scenario():
        runner = RetryRunner(create_retry_policy(max_attempts=5), clock=FakeClock(0))

        def fatal(_):
            raise RuntimeError("fatal")

        with pytest.raises(RetryError) as exc:
            await runner.run(fatal)
        assert exc.value.code == "RETRY_EXHAUSTED"
        assert exc.value.attempts == 1

    run(scenario())


def test_attempt_timeout_uses_the_injected_clock_deterministically():
    async def scenario():
        clock = FakeClock(0)
        runner = RetryRunner(
            create_retry_policy(max_attempts=1),
            clock=clock,
        )

        async def operation(_):
            await asyncio.Event().wait()

        promise = asyncio.create_task(runner.run(operation, attempt_timeout_ms=100))
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        assert len(clock.timers) == 1
        clock.advance(99)
        await asyncio.sleep(0)
        assert not promise.done()
        clock.advance(1)
        await asyncio.sleep(0)
        with pytest.raises(RetryError) as exc:
            await promise
        assert exc.value.code == "RETRY_EXHAUSTED"
        assert exc.value.attempts == 1
        assert len(clock.timers) == 0

    run(scenario())


def test_attempt_timeout_is_retryable():
    async def scenario():
        clock = FakeClock(0)
        runner = RetryRunner(
            create_retry_policy(max_attempts=2, base_delay_ms=50),
            clock=clock,
        )

        async def operation(_):
            await asyncio.Event().wait()

        promise = asyncio.create_task(runner.run(operation, attempt_timeout_ms=100))
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        clock.advance(100)
        await asyncio.sleep(0)
        clock.advance(50)
        await asyncio.sleep(0)
        clock.advance(100)
        await asyncio.sleep(0)
        with pytest.raises(RetryError) as exc:
            await promise
        assert exc.value.code == "RETRY_EXHAUSTED"
        assert exc.value.attempts == 2

    run(scenario())


def test_cancellation_during_backoff_cleans_timer():
    async def scenario():
        clock = FakeClock(0)
        runner = RetryRunner(create_retry_policy(max_attempts=3, base_delay_ms=100), clock=clock)
        cancelled = asyncio.Event()

        async def operation(_):
            raise RetryableError("temporary")

        promise = asyncio.create_task(runner.run(operation, signal=cancelled))
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        cancelled.set()
        with pytest.raises(RetryError) as exc:
            await promise
        assert exc.value.code == "CANCELLED"
        assert exc.value.cancelled is True
        assert len(clock.timers) == 0

    run(scenario())


def test_total_budget_prevents_retry_that_exceeds_budget():
    async def scenario():
        clock = FakeClock(0)
        runner = RetryRunner(
            create_retry_policy(max_attempts=5, base_delay_ms=100, total_budget_ms=50),
            clock=clock,
        )

        def fail(_):
            raise RetryableError("temporary")

        with pytest.raises(RetryError) as exc:
            await runner.run(fail)
        assert exc.value.code == "BUDGET_EXCEEDED"

    run(scenario())


def test_policy_validation_rejects_invalid_configuration():
    with pytest.raises(ValueError):
        create_retry_policy(max_attempts=0)
    with pytest.raises(TypeError):
        create_retry_policy(backoff="unknown")
    with pytest.raises(ValueError):
        create_retry_policy(factor=0)
    with pytest.raises(TypeError):
        create_retry_policy(jitter="unknown")
    with pytest.raises(TypeError):
        create_retry_policy(random_source=object())


def test_retry_error_is_immutable():
    error = RetryError("TEST", "message")
    with pytest.raises(AttributeError):
        error.code = "OTHER"
