"""Native tests for the RETRY1 retry Python port (contract-grounded)."""

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_retry import (
    RetryError,
    RetryRunner,
    create_retry_policy,
    RealClock,
    FakeClock,
    AbortController,
    AbortSignal,
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
    runner = RetryRunner(
        create_retry_policy(max_attempts=3, base_delay_ms=100), clock=clock
    )
    count = 0

    async def operation(ctx):
        nonlocal count
        count += 1
        if count < 3:
            # Create a retryable error
            class TempError(Exception):
                retryable = True

            raise TempError("temporary")
        assert ctx["signal"].aborted is False
        return "ok"

    promise = runner.run(operation)
    await flush_microtasks()
    clock.advance(100)
    await flush_microtasks()
    clock.advance(200)
    await flush_microtasks()
    result = await promise

    assert result.value == "ok"
    assert len(result.attempts) == 3
    assert result.attempts[0].retry is True
    assert result.attempts[1].delay_ms == 200


async def test_non_retryable_errors_stop_immediately() -> None:
    runner = RetryRunner(
        create_retry_policy(max_attempts=5), clock=FakeClock(0)
    )

    try:
        await runner.run(lambda _: (_ for _ in ()).throw(Exception("fatal")))
        assert False, "should have raised"
    except RetryError as error:
        assert error.code == "RETRY_EXHAUSTED"
        assert error.attempts == 1
        assert error.retryable is False


async def test_attempt_timeout_aborts_the_attempt_and_is_retryable_by_default() -> None:
    clock = FakeClock(0)
    runner = RetryRunner(
        create_retry_policy(max_attempts=2, base_delay_ms=50), clock=clock
    )

    async def operation(ctx):
        # This operation never completes, it will be aborted by timeout
        if ctx["signal"].aborted:
            raise ctx["signal"].reason
        await asyncio.Event().wait()

    promise = runner.run(operation, attempt_timeout_ms=100)
    await flush_microtasks()
    clock.advance(100)
    await flush_microtasks()
    clock.advance(50)
    await flush_microtasks()
    clock.advance(100)
    await flush_microtasks()

    try:
        await promise
        assert False, "should have raised"
    except RetryError as error:
        assert error.code == "RETRY_EXHAUSTED"
        assert error.attempts == 2


async def test_abort_signal_cancels_during_backoff_and_cleans_the_timer() -> None:
    clock = FakeClock(0)
    runner = RetryRunner(
        create_retry_policy(max_attempts=3, base_delay_ms=100), clock=clock
    )
    controller = AbortController()

    async def operation(_):
        class TempError(Exception):
            retryable = True

        raise TempError("temporary")

    promise = runner.run(operation, signal=controller.signal)
    await flush_microtasks()
    controller.abort(Exception("stop"))

    try:
        await promise
        assert False, "should have raised"
    except RetryError as error:
        assert error.code == "CANCELLED"
        assert error.cancelled is True

    # All timers should be cleaned up
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

    promise = runner.run(operation)
    await flush_microtasks()

    try:
        await promise
        assert False, "should have raised"
    except RetryError as error:
        assert error.code == "BUDGET_EXCEEDED"


def test_policy_validation_rejects_invalid_configuration() -> None:
    # maxAttempts must be >= 1
    try:
        create_retry_policy(max_attempts=0)
        assert False, "should have raised ValueError"
    except (ValueError, TypeError):
        pass

    # backoff must be one of fixed, linear, exponential
    try:
        create_retry_policy(backoff="unknown")
        assert False, "should have raised TypeError"
    except TypeError:
        pass

    # factor must be >= 1
    try:
        create_retry_policy(factor=0)
        assert False, "should have raised ValueError"
    except (ValueError, TypeError):
        pass

    # jitter must be none, full, or bounded
    try:
        create_retry_policy(jitter="unknown")
        assert False, "should have raised TypeError"
    except TypeError:
        pass


def test_linear_backoff_computes_correct_delays() -> None:
    linear = create_retry_policy(backoff="linear", base_delay_ms=50)
    assert linear.delay_for(1) == 50
    assert linear.delay_for(2) == 100
    assert linear.delay_for(3) == 150


def test_max_delay_caps_exponential_backoff() -> None:
    policy = create_retry_policy(
        backoff="exponential", base_delay_ms=100, factor=2, max_delay_ms=150
    )
    assert policy.delay_for(1) == 100
    assert policy.delay_for(2) == 150  # capped at 150
    assert policy.delay_for(3) == 150  # capped at 150


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
    def custom_retryable(e: BaseException) -> bool:
        return isinstance(e, ValueError)

    policy = create_retry_policy(max_attempts=2, retryable=custom_retryable)
    runner = RetryRunner(policy, clock=FakeClock(0))

    # ValueError should be retryable
    async def operation_retryable(_):
        raise ValueError("retry me")

    # TypeError should NOT be retryable
    async def operation_non_retryable(_):
        raise TypeError("fatal")

    # Test retryable
    try:
        await runner.run(operation_retryable)
        assert False, "should have raised after retries exhausted"
    except RetryError as e:
        assert e.code == "RETRY_EXHAUSTED"
        assert e.attempts == 2

    # Test non-retryable
    try:
        await runner.run(operation_non_retryable)
        assert False, "should have raised"
    except RetryError as e:
        assert e.code == "RETRY_EXHAUSTED"
        assert e.attempts == 1


async def test_real_clock_works() -> None:
    clock = RealClock()
    now = clock.now()
    assert isinstance(now, int)
    assert now >= 0


def test_fake_clock_advance_clears_timers_in_order() -> None:
    clock = FakeClock(0)
    results = []

    def cb1():
        results.append("first")

    def cb2():
        results.append("second")

    clock.set_timeout(cb1, 200)
    clock.set_timeout(cb2, 100)

    clock.advance(50)
    assert results == []

    clock.advance(50)  # at 100
    assert results == ["second"]

    clock.advance(100)  # at 200
    assert results == ["second", "first"]


async def test_runner_immutable_after_creation() -> None:
    runner = RetryRunner(create_retry_policy(), clock=FakeClock(0))
    try:
        runner.policy = create_retry_policy(max_attempts=10)
        assert False, "should have raised AttributeError"
    except AttributeError:
        pass


async def test_max_delay_ms_with_jitter() -> None:
    policy = create_retry_policy(
        backoff="exponential",
        base_delay_ms=100,
        factor=2,
        max_delay_ms=150,
        jitter="full",
        random=lambda: 0.5,  # 50% jitter
    )
    # Attempt 2: raw=200, capped=150, jitter=75
    assert policy.delay_for(2) == 75


async def test_fake_clock_negative_values_rejected() -> None:
    try:
        FakeClock(-1)
        assert False, "should have raised"
    except ValueError:
        pass

    clock = FakeClock(0)
    try:
        clock.advance(-1)
        assert False, "should have raised"
    except ValueError:
        pass

    try:
        clock.set_timeout(lambda: None, -1)
        assert False, "should have raised"
    except ValueError:
        pass


async def test_retry_runner_operation_must_be_callable() -> None:
    runner = RetryRunner(clock=FakeClock(0))
    try:
        await runner.run("not a function")
        assert False, "should have raised TypeError"
    except TypeError:
        pass


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

    # Removing listener
    called.clear()
    signal.remove_event_listener(listener)
    signal.abort(Exception("test2"))
    assert len(called) == 0


if __name__ == "__main__":
    # Run sync tests
    test_fixed_and_exponential_policies_compute_deterministic_delays()
    test_jitter_is_deterministic_when_random_source_is_injected()
    test_policy_validation_rejects_invalid_configuration()
    test_linear_backoff_computes_correct_delays()
    test_max_delay_caps_exponential_backoff()
    test_retry_error_attributes()
    test_custom_retryable_classifier()
    test_fake_clock_advance_clears_timers_in_order()
    test_fake_clock_negative_values_rejected()
    print("All sync tests passed!")

    # Run async tests
    async def run_async_tests():
        await test_retry_runner_retries_retryable_failures_and_returns_attempt_history()
        await test_non_retryable_errors_stop_immediately()
        await test_attempt_timeout_aborts_the_attempt_and_is_retryable_by_default()
        await test_abort_signal_cancels_during_backoff_and_cleans_the_timer()
        await test_total_budget_prevents_a_retry_that_would_exceed_the_budget()
        await test_real_clock_works()
        await test_runner_immutable_after_creation()
        await test_max_delay_ms_with_jitter()
        await test_retry_runner_operation_must_be_callable()
        await test_abort_controller_basic()
        await test_abort_signal_listeners()
        print("All async tests passed!")

    asyncio.run(run_async_tests())
    print("All tests passed!")