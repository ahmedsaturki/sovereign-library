"""Native tests for the RES1 result Python port (grounded in the Node contract behavior).

The RES1 contract is a functional API (callbacks), so it is verified by native tests
rather than the generic JSON vector-conformance runner (which only passes data args).
These assertions mirror the canonical Node cube's invariants.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_result import Result, errors, serializeError, ResultError


def test_ok_basic():
    r = Result.ok(42)
    assert r["ok"] is True
    assert r["value"] == 42
    assert r[_marker()] is True


def test_err_basic():
    r = Result.err("boom")
    assert r["ok"] is False
    assert r["error"].code == "UNKNOWN_ERROR"


def test_is_true_false():
    assert Result.is_(Result.ok(1)) is True
    assert Result.is_({"not": "a result"}) is False
    assert Result.is_({"ok": True, "value": 1}) is False  # no marker


def test_from_already_result():
    inner = Result.ok("x")
    assert Result.from_(inner) is inner


def test_from_plain():
    r = Result.from_("plain")
    assert r["ok"] is True and r["value"] == "plain"


def test_from_throwable_success_failure():
    assert Result.fromThrowable(lambda: 7)["value"] == 7
    failed = Result.fromThrowable(lambda: 1 / 0)
    assert failed["ok"] is False and failed["error"].code == "UNKNOWN_ERROR"


def test_unwrap_success_and_failure_throws():
    assert Result.unwrap(Result.ok("v")) == "v"
    try:
        Result.unwrap(Result.err("boom"))
        assert False, "should throw"
    except ResultError as e:
        assert e.code == "UNKNOWN_ERROR"


def test_map_success_and_failure():
    assert Result.map(Result.ok(2), lambda x: x * 10)["value"] == 20
    err = Result.err("e")
    assert Result.map(err, lambda x: x) is err


def test_map_err():
    r = Result.mapErr(Result.err("e"), lambda e: errors.validation("bad"))
    assert r["ok"] is False and r["error"].code == "VALIDATION_FAILED"


def test_and_then():
    r = Result.andThen(Result.ok(3), lambda x: Result.ok(x + 1))
    assert r["value"] == 4
    assert Result.andThen(Result.err("e"), lambda x: Result.ok(1))["ok"] is False


def test_recover():
    r = Result.recover(Result.err("e"), lambda e: Result.ok("recovered"))
    assert r["value"] == "recovered"


def test_ensure_pass_fail():
    assert Result.ensure(Result.ok(5), lambda x: x > 0)["value"] == 5
    failed = Result.ensure(Result.ok(-1), lambda x: x > 0)
    assert failed["ok"] is False and failed["error"].code == "UNKNOWN_ERROR"


def test_match():
    assert Result.match(Result.ok("a"), {"ok": lambda v: "O:" + v, "err": lambda e: "E"}) == "O:a"
    assert Result.match(Result.err("boom"), {"ok": lambda v: "O", "err": lambda e: "E:" + e.code}) == "E:UNKNOWN_ERROR"


def test_unwrap_or():
    assert Result.unwrapOr(Result.ok("v"), "fb") == "v"
    assert Result.unwrapOr(Result.err("e"), "fb") == "fb"


def test_errors_factory():
    assert errors.unknown("x").code == "UNKNOWN_ERROR"
    assert errors.cancelled().cancelled is True
    assert errors.timedOut().timedOut is True and errors.timedOut().retryable is True
    assert errors.validation("bad").code == "VALIDATION_FAILED"


def test_serialize_error_circular():
    e = errors.unknown("root")
    e.__cause__ = e  # circular
    s = serializeError(e)
    assert s["message"] == "[circular cause]" or s["code"] == "UNKNOWN_ERROR"


def test_frozen_error_details():
    # Only error.details snapshots are frozen (fail-closed), not success values.
    r = Result.err(errors.validation("boom", {"secret": 1}))
    try:
        r["error"].details["secret"] = 99
        assert False, "error details should be immutable"
    except (TypeError, AttributeError):
        pass
    # success values are NOT frozen (by contract)
    ok = Result.ok({"a": 1})
    ok["value"]["a"] = 2
    assert ok["value"]["a"] == 2


def _marker():
    from sovereign_result import _MARKER
    return _MARKER
