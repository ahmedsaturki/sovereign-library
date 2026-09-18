"""Native tests for the RCI1 runtime-capability-inspector Python port (contract-grounded)."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_runtime_capability_inspector import (  # noqa: E402
    inspectRuntime,
    evaluateRuntimeRequirements,
    serializeRuntimeReport,
    parseRuntimeReport,
    RUNTIME_CAPABILITY_FORMAT,
    RUNTIME_OS_FAMILIES,
    RUNTIME_ARCHITECTURES,
    RuntimeCapabilityError,
)


ENV = {"PATH": "/usr/bin:/bin", "PATHEXT": ".EXE"}


def test_format_constants():
    assert RUNTIME_CAPABILITY_FORMAT == "RCI1"
    assert RUNTIME_OS_FAMILIES == ["linux", "darwin", "win32", "freebsd", "openbsd",
                                   "sunos", "aix", "android", "other"]
    assert RUNTIME_ARCHITECTURES == ["x64", "arm64", "arm", "ia32", "ppc64", "ppc64le",
                                     "s390x", "riscv64", "loong64", "other"]


def test_inspect_shape_and_format():
    snap = inspectRuntime({"env": ENV})
    assert snap["format"] == "RCI1"
    assert snap["mode"] == "runtime_capability_snapshot"
    assert set(snap.keys()) == {"format", "mode", "platform", "runtime", "resources", "environment"}


def test_evaluate_pass():
    snap = inspectRuntime({"env": ENV})
    verdict = evaluateRuntimeRequirements(snap, {"os": [snap["platform"]["os"]],
                                                 "architectures": [snap["platform"]["architecture"]]})
    assert verdict["passed"] is True
    assert verdict["failures"] == []


def test_evaluate_unsupported_os_rejected():
    try:
        evaluateRuntimeRequirements({"format": "RCI1", "mode": "runtime_capability_snapshot"},
                                    {"os": ["nonexistent-os"]})
        assert False, "expected RuntimeCapabilityError"
    except RuntimeCapabilityError as err:
        assert err.code == "INVALID_REQUIREMENT"


def test_evaluate_cpu_too_low():
    snap = inspectRuntime({"env": ENV})
    verdict = evaluateRuntimeRequirements(snap, {"minCpuCount": 10 ** 9})
    assert verdict["passed"] is False
    assert verdict["failures"][0]["code"] == "CPU_COUNT_TOO_LOW"


def test_serialize_roundtrip():
    snap = inspectRuntime({"env": ENV})
    serialized = serializeRuntimeReport(snap)
    parsed = parseRuntimeReport(serialized)
    assert parsed["format"] == "RCI1"
    assert parsed["mode"] == "runtime_capability_snapshot"
