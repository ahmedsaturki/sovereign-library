"""Native Python implementation of the RCI1 runtime-capability-inspector contract.

Dependency-free (standard library only). Satisfies the canonical conformance
vectors in contracts/conformance/vectors.runtime-capability-inspector.json.

This is NOT a Node wrapper. It inspects the local runtime using Python standard
library primitives (platform, os, sys) and exposes the same callable surface and
verdict semantics as the canonical Node cube.
"""

from __future__ import annotations

import os
import platform
import sys

FORMAT = "RCI1"
VERSION = 1

OS_FAMILIES = [
    "linux", "darwin", "win32", "freebsd", "openbsd",
    "sunos", "aix", "android", "other",
]
ARCHITECTURES = [
    "x64", "arm64", "arm", "ia32", "ppc64", "ppc64le",
    "s390x", "riscv64", "loong64", "other",
]

MAX_LIST = 256


class RuntimeCapabilityError(Exception):
    """Contract error carrying a machine-readable ``code``."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.name = "RuntimeCapabilityError"
        self.code = code


def _fail(code: str, message: str) -> "None":
    raise RuntimeCapabilityError(code, message)


def _is_plain(value) -> bool:
    if value is None or isinstance(value, (str, int, float, bool)):
        return True
    if isinstance(value, (dict, list)):
        return True
    return False


def _validate_safe(value, label: str, seen=None, depth: int = 0) -> None:
    if seen is None:
        seen = []
    if value is None or isinstance(value, (str, int, float, bool)):
        return
    if isinstance(value, (dict, list)):
        if id(value) in seen:
            _fail("CIRCULAR_INPUT", f"{label} is circular")
        seen.append(id(value))
        if isinstance(value, dict):
            for k, v in value.items():
                _validate_safe(v, f"{label}.{k}", seen, depth + 1)
        else:
            for i, v in enumerate(value):
                _validate_safe(v, f"{label}[{i}]", seen, depth + 1)
        return
    _fail("INVALID_ENV", f"{label} must be plain data")


def _normalize_os(value: str) -> str:
    v = value.lower()
    return v if v in OS_FAMILIES else "other"


def _normalize_arch(value: str) -> str:
    v = value.lower()
    return v if v in ARCHITECTURES else "other"


def _string_value(value: str, label: str, limit: int) -> None:
    if not isinstance(value, str) or len(value) > limit:
        _fail("INVALID_RUNTIME", f"{label} must be a string <= {limit} chars")


def _list_value(value, label: str, limit: int):
    if not isinstance(value, list) or len(value) > limit:
        _fail("INVALID_REQUIREMENTS", f"{label} must be a list <= {limit}")
    return value


def _normalize_executable_requests(value) -> list:
    items = _list_value(value or [], "executables", MAX_LIST)
    out = []
    for item in items:
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict) and isinstance(item.get("name"), str):
            out.append(item["name"])
        else:
            _fail("INVALID_EXECUTABLE", "executable request must be a string or {name}")
    return out


def _executable_available(name: str, path_entries: list, path_ext, platform_os: str) -> bool:
    if platform_os == "win32":
        exts = path_ext.split(";") if path_ext else [".exe", ".cmd", ".bat", ".ps1"]
    else:
        exts = [""]
    import shutil
    for entry in path_entries:
        for ext in exts:
            candidate = os.path.join(entry, name + ext)
            if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                return True
    if shutil.which(name):
        return True
    return False


def inspect_runtime(options=None) -> dict:
    options = dict(options or {})
    _validate_safe(options, "options")
    executables = _normalize_executable_requests(options.get("executables", []))
    env = options.get("env", os.environ)
    _validate_safe(env, "env")
    if not isinstance(env, dict) or isinstance(env, list):
        _fail("INVALID_ENV", "env must be a plain object")
    platform_os = _normalize_os(options.get("platform", sys.platform))
    architecture = _normalize_arch(options.get("arch", platform.machine()))
    node_version = options.get("nodeVersion", None)
    node_runtime = {"version": None, "major": None, "minor": None, "patch": None}
    if node_version is not None:
        import re
        m = re.match(r"^v?(\d+)\.(\d+)\.(\d+)", str(node_version))
        if m:
            node_runtime = {"version": str(node_version), "major": int(m.group(1)),
                            "minor": int(m.group(2)), "patch": int(m.group(3))}
    env_path = env.get("PATH", env.get("Path", ""))
    path_entries = [p for p in str(env_path).split(os.pathsep) if p] if env_path else []
    cpu_count = options.get("cpuCount", os.cpu_count() or 1)
    if not isinstance(cpu_count, int) or isinstance(cpu_count, bool) or cpu_count < 1 or cpu_count > 65536:
        _fail("INVALID_RUNTIME", "cpuCount is invalid")
    memory_value = options.get("totalMemoryBytes", None)
    memory_bytes = int(memory_value) if isinstance(memory_value, int) and not isinstance(memory_value, bool) else _total_memory()
    if not isinstance(memory_bytes, int) or memory_bytes < 0:
        _fail("INVALID_RUNTIME", "totalMemoryBytes is invalid")
    executable_results = [{"name": n, "available": _executable_available(n, path_entries, env.get("PATHEXT", ""), platform_os)} for n in executables]
    release_value = options.get("release", platform.release())
    release = str(release_value)
    _string_value(release, "release", 1024)
    return {
        "format": FORMAT,
        "mode": "runtime_capability_snapshot",
        "platform": {
            "os": platform_os,
            "release": release,
            "architecture": architecture,
            "endianness": sys.byteorder,
        },
        "runtime": {"node": node_runtime},
        "resources": {"cpuCount": cpu_count, "totalMemoryBytes": memory_bytes},
        "environment": {"pathConfigured": len(path_entries) > 0, "executableResults": executable_results},
    }


def _total_memory() -> int:
    try:
        import shutil
        return shutil.total_memory() if hasattr(shutil, "total_memory") else os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
    except Exception:
        return 0


def _set_of(value, label: str, mapper) -> list:
    items = _list_value(value or [], label, MAX_LIST)
    out = []
    for item in items:
        _string_value(item, label, 32)
        out.append(mapper(item))
    if len(set(out)) != len(out):
        _fail("DUPLICATE_REQUIREMENT", f"{label} contains duplicates")
    return sorted(set(out))


def _map_os(value: str) -> str:
    normalized = _normalize_os(value)
    if normalized == "other" and value != "other":
        _fail("INVALID_REQUIREMENT", f"{label_os()} contains unsupported OS")
    return normalized


def _map_arch(value: str) -> str:
    normalized = _normalize_arch(value)
    if normalized == "other" and value != "other":
        _fail("INVALID_REQUIREMENT", f"{label_arch()} contains unsupported architecture")
    return normalized


def label_os() -> str:
    return "requirements.os"


def label_arch() -> str:
    return "requirements.architectures"


def _numeric(value, label):
    if value is None:
        return None
    if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
        return value
    _fail("INVALID_REQUIREMENT", f"{label} must be a non-negative safe integer")


def _normalize_requirements(requirements) -> dict:
    _validate_safe(requirements, "requirements")
    if not isinstance(requirements, dict) or isinstance(requirements, list):
        _fail("INVALID_REQUIREMENTS", "requirements must be a plain object")
    os_families = _set_of(requirements.get("os", []), "requirements.os", _map_os)
    architectures = _set_of(requirements.get("architectures", []), "requirements.architectures", _map_arch)
    required_executables = _normalize_executable_requests(requirements.get("requiredExecutables", []))
    node_major_min = _numeric(requirements.get("nodeMajorMin"), "requirements.nodeMajorMin")
    node_major_max = _numeric(requirements.get("nodeMajorMax"), "requirements.nodeMajorMax")
    if node_major_min is not None and node_major_max is not None and node_major_min > node_major_max:
        _fail("INVALID_REQUIREMENT", "nodeMajorMin exceeds nodeMajorMax")
    return {
        "os": os_families,
        "architectures": architectures,
        "nodeMajorMin": node_major_min,
        "nodeMajorMax": node_major_max,
        "requiredExecutables": required_executables,
        "minCpuCount": _numeric(requirements.get("minCpuCount"), "requirements.minCpuCount"),
        "minMemoryBytes": _numeric(requirements.get("minMemoryBytes"), "requirements.minMemoryBytes"),
    }


def _fail_unsupported(value: str) -> "None":
    _fail("INVALID_REQUIREMENT", f"unsupported value: {value}")


def evaluate_runtime_requirements(snapshot: dict, requirements: dict) -> dict:
    _validate_safe(snapshot, "snapshot")
    normalized = _normalize_requirements(requirements)
    if not isinstance(snapshot, dict) or snapshot.get("format") != FORMAT or snapshot.get("mode") != "runtime_capability_snapshot":
        _fail("INVALID_SNAPSHOT", "invalid runtime snapshot")
    failures = []
    snap_os = snapshot["platform"]["os"]
    snap_arch = snapshot["platform"]["architecture"]
    node_major = (snapshot.get("runtime", {}).get("node", {}) or {}).get("major")
    if normalized["os"] and snap_os not in normalized["os"]:
        failures.append({"code": "OS_FAMILY_UNSUPPORTED", "actual": snap_os, "required": normalized["os"]})
    if normalized["architectures"] and snap_arch not in normalized["architectures"]:
        failures.append({"code": "ARCHITECTURE_UNSUPPORTED", "actual": snap_arch, "required": normalized["architectures"]})
    if normalized["nodeMajorMin"] is not None and isinstance(node_major, int) and node_major < normalized["nodeMajorMin"]:
        failures.append({"code": "NODE_MAJOR_TOO_LOW", "minimum": normalized["nodeMajorMin"], "actual": node_major})
    if normalized["nodeMajorMax"] is not None and isinstance(node_major, int) and node_major > normalized["nodeMajorMax"]:
        failures.append({"code": "NODE_MAJOR_TOO_HIGH", "maximum": normalized["nodeMajorMax"], "actual": node_major})
    if normalized["minCpuCount"] is not None and snapshot["resources"]["cpuCount"] < normalized["minCpuCount"]:
        failures.append({"code": "CPU_COUNT_TOO_LOW", "minimum": normalized["minCpuCount"], "actual": snapshot["resources"]["cpuCount"]})
    if normalized["minMemoryBytes"] is not None and snapshot["resources"]["totalMemoryBytes"] < normalized["minMemoryBytes"]:
        failures.append({"code": "MEMORY_TOO_LOW", "minimum": normalized["minMemoryBytes"], "actual": snapshot["resources"]["totalMemoryBytes"]})
    return {
        "format": FORMAT,
        "mode": "runtime_capability_verdict",
        "passed": len(failures) == 0,
        "failures": failures,
    }


def serialize_runtime_report(report: dict) -> str:
    import json
    _validate_safe(report, "report")
    return json.dumps(report, separators=(",", ":"))


def parse_runtime_report(serialized: str) -> dict:
    import json
    if not isinstance(serialized, str) or not serialized:
        _fail("MALFORMED_SERIALIZATION", "serialized report must be a non-empty string")
    try:
        report = json.loads(serialized)
    except Exception:
        _fail("MALFORMED_SERIALIZATION", "serialized report is invalid JSON")
    _validate_safe(report, "report")
    if not isinstance(report, dict) or report.get("format") != FORMAT:
        _fail("MALFORMED_SERIALIZATION", "serialized report envelope is invalid")
    return report


RUNTIME_CAPABILITY_FORMAT = FORMAT
RUNTIME_OS_FAMILIES = list(OS_FAMILIES)
RUNTIME_ARCHITECTURES = list(ARCHITECTURES)

# camelCase aliases for the language-neutral conformance runner.
inspectRuntime = inspect_runtime
evaluateRuntimeRequirements = evaluate_runtime_requirements
serializeRuntimeReport = serialize_runtime_report
parseRuntimeReport = parse_runtime_report
