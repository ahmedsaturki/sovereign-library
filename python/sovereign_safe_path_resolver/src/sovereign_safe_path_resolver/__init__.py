"""Native Python implementation of the SPR1 safe-path-resolver contract.

Dependency-free (standard library only). Satisfies the canonical conformance
vectors in contracts/conformance/vectors.safe-path-resolver.json.

This is NOT a Node wrapper. It is an independent native implementation that
must produce identical observable contract behavior to the canonical Node cube.
"""

from __future__ import annotations

import hashlib
import json
import math
import re

FORMAT = "SPR1"
VERSION = 1
MAX_PATH = 32 * 1024
MAX_SEGMENTS = 1024
MAX_SYMLINK_DEPTH = 64
MAX_SERIALIZED = 256 * 1024


class SafePathResolverError(Exception):
    """Contract error carrying a machine-readable ``code``."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.name = "SafePathResolverError"
        self.code = code


def _fail(code: str, message: str) -> "None":
    raise SafePathResolverError(code, message)


def _validate_plain(value, label: str, seen=None, depth: int = 0) -> None:
    if seen is None:
        seen = []
    if depth > 16:
        _fail("LIMIT_EXCEEDED", f"{label} exceeds validation depth")
    if value is None or isinstance(value, (str, int, float, bool)):
        return
    if isinstance(value, (dict, list)):
        if id(value) in seen:
            _fail("CIRCULAR_INPUT", f"{label} is circular")
        seen.append(id(value))
        if isinstance(value, dict):
            for k, v in value.items():
                _validate_plain(v, f"{label}.{k}", seen, depth + 1)
        else:
            for i, v in enumerate(value):
                _validate_plain(v, f"{label}[{i}]", seen, depth + 1)
        return
    _fail("INVALID_ENV", f"{label} must be plain data")


def _validate_options(options=None):
    options = dict(options or {})
    _validate_plain(options, "options")
    normalized = {
        "separatorNormalization": bool(options.get("separatorNormalization", True)),
        "normalizeDotSegments": bool(options.get("normalizeDotSegments", True)),
        "caseMode": options.get("caseMode", "sensitive"),
        "preserveNamespace": bool(options.get("preserveNamespace", True)),
        "maxSegments": options.get("maxSegments", MAX_SEGMENTS),
        "symlinkPolicy": options.get("symlinkPolicy", "lexical-only"),
        "maxSymlinkDepth": options.get("maxSymlinkDepth", MAX_SYMLINK_DEPTH),
    }
    if not isinstance(normalized["separatorNormalization"], bool):
        _fail("INVALID_PATH", "separatorNormalization must be boolean")
    if not isinstance(normalized["normalizeDotSegments"], bool):
        _fail("INVALID_PATH", "normalizeDotSegments must be boolean")
    if normalized["caseMode"] not in ("sensitive", "insensitive"):
        _fail("INVALID_PATH", "caseMode must be sensitive or insensitive")
    if not isinstance(normalized["preserveNamespace"], bool):
        _fail("INVALID_PATH", "preserveNamespace must be boolean")
    if not isinstance(normalized["maxSegments"], int) or isinstance(normalized["maxSegments"], bool) \
            or normalized["maxSegments"] < 1 or normalized["maxSegments"] > MAX_SEGMENTS:
        _fail("LIMIT_EXCEEDED", f"maxSegments must be between 1 and {MAX_SEGMENTS}")
    if normalized["symlinkPolicy"] not in ("lexical-only", "reject-symlink", "follow-contained"):
        _fail("SYMLINK_REJECTED", "invalid symlink policy")
    if not isinstance(normalized["maxSymlinkDepth"], int) or isinstance(normalized["maxSymlinkDepth"], bool) \
            or normalized["maxSymlinkDepth"] < 1 or normalized["maxSymlinkDepth"] > MAX_SYMLINK_DEPTH:
        _fail("LIMIT_EXCEEDED", f"maxSymlinkDepth must be between 1 and {MAX_SYMLINK_DEPTH}")
    return normalized


def _validate_path_input(value: str, label: str) -> None:
    if not isinstance(value, str):
        _fail("INVALID_PATH", f"{label} must be a string")
    if not value or "\0" in value:
        _fail("INVALID_PATH", f"{label} must be non-empty and NUL-free")
    if len(value) > MAX_PATH:
        _fail("LIMIT_EXCEEDED", f"{label} exceeds {MAX_PATH} characters")


def _normalize_separators(value: str, options) -> str:
    return value.replace("\\", "/") if options["separatorNormalization"] else value


def _root_descriptor(value: str):
    import re
    if re.match(r"^//\?/UNC/", value):
        parts = value[len("//?/UNC/"):].split("/")
        if len(parts) < 2 or not parts[0] or not parts[1]:
            _fail("ROOT_MISMATCH", "invalid UNC namespace root")
        return {"kind": "namespace-unc", "identity": f"namespace-unc:{parts[0]}/{parts[1]}",
                "prefix": f"//?/UNC/{parts[0]}/{parts[1]}", "rest": parts[2:]}
    if re.match(r"^//\?/[A-Za-z]:($|/)", value):
        drive = value[4:6].upper()
        rest_start = 7 if value[6:7] == "/" else 6
        return {"kind": "namespace-drive", "identity": f"namespace-drive:{drive}",
                "prefix": f"//?/{drive}", "rest": value[rest_start:].split("/")}
    if re.match(r"^[A-Za-z]:/", value):
        drive = value[0:2].upper()
        return {"kind": "drive", "identity": f"drive:{drive}", "prefix": f"{drive}/",
                "rest": value[3:].split("/")}
    if value.startswith("//"):
        parts = value[2:].split("/")
        if len(parts) < 2 or not parts[0] or not parts[1]:
            _fail("ROOT_MISMATCH", "invalid UNC root")
        return {"kind": "unc", "identity": f"unc:{parts[0]}/{parts[1]}",
                "prefix": f"//{parts[0]}/{parts[1]}", "rest": parts[2:]}
    if value.startswith("/"):
        return {"kind": "posix", "identity": "posix:/", "prefix": "/", "rest": value[1:].split("/")}
    return {"kind": "relative", "identity": "", "prefix": "", "rest": value.split("/")}


def _normalize_segments(raw_segments, descriptor, options):
    if len(raw_segments) > options["maxSegments"]:
        _fail("LIMIT_EXCEEDED", f"path exceeds {options['maxSegments']} segments")
    out = []
    for segment in raw_segments:
        if segment == "" or segment == ".":
            continue
        if segment == "..":
            if not options["normalizeDotSegments"]:
                out.append(segment)
                continue
            if out and out[-1] != "..":
                out.pop()
                continue
            if descriptor["kind"] != "relative":
                _fail("TRAVERSAL_ESCAPE", "path escapes an absolute root")
            _fail("TRAVERSAL_ESCAPE", "relative path escapes its caller-defined scope")
        out.append(segment)
        if len(out) > options["maxSegments"]:
            _fail("LIMIT_EXCEEDED", f"path exceeds {options['maxSegments']} segments")
    return out


def _format_descriptor(descriptor, segments):
    body = "/".join(segments)
    kind = descriptor["kind"]
    if kind == "relative":
        return body or "."
    if kind == "posix":
        return f"/{body}" if body else "/"
    if kind == "drive":
        return f"{descriptor['prefix']}{body}" if body else descriptor["prefix"]
    if kind in ("unc", "namespace-drive", "namespace-unc"):
        return f"{descriptor['prefix']}/{body}" if body else descriptor["prefix"]
    _fail("ROOT_MISMATCH", "unsupported root descriptor")


def _parse_and_normalize(value: str, options=None):
    _validate_path_input(value, "path")
    opts = _validate_options(options)
    normalized_input = _normalize_separators(value, opts)
    if re.match(r"^[A-Za-z]:[^/]", normalized_input):
        _fail("ROOT_MISMATCH", "drive-relative paths such as C:foo are rejected")
    descriptor = _root_descriptor(normalized_input)
    segments = _normalize_segments(descriptor["rest"], descriptor, opts)
    return {
        "format": FORMAT,
        "root": {"kind": descriptor["kind"], "identity": descriptor["identity"], "prefix": descriptor["prefix"]},
        "absolute": descriptor["kind"] != "relative",
        "segments": list(segments),
        "path": _format_descriptor(descriptor, segments),
        "options": opts,
    }


def _normalize_case(value: str, case_mode: str) -> str:
    return value.lower() if case_mode == "insensitive" else value


def _same_root(left, right, case_mode: str) -> bool:
    return _normalize_case(left["identity"], case_mode) == _normalize_case(right["identity"], case_mode)


def _segment_compare(left: str, right: str, case_mode: str) -> int:
    a, b = _normalize_case(left, case_mode), _normalize_case(right, case_mode)
    return (a > b) - (a < b)


def _contains_normalized(candidate, root, options) -> bool:
    if not _same_root(candidate["root"], root["root"], options["caseMode"]) \
            or not candidate["absolute"] or not root["absolute"]:
        return False
    if len(candidate["segments"]) < len(root["segments"]):
        return False
    for i in range(len(root["segments"])):
        if _segment_compare(candidate["segments"][i], root["segments"][i], options["caseMode"]) != 0:
            return False
    return True


def _canonical_payload(value) -> str:
    _validate_plain(value, "payload")
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _integrity_digest(payload: str) -> str:
    return hashlib.sha256(f"{FORMAT}|{VERSION}|{payload}".encode("utf-8")).hexdigest()


def _verify_integrity(expected: str, actual: str) -> None:
    if not isinstance(expected, str) or not re.match(r"^[0-9a-f]{64}$", expected):
        _fail("INTEGRITY_FAILURE", "serialized report integrity is invalid")
    if len(expected) != len(actual) or not _ct_eq(expected, actual):
        _fail("INTEGRITY_FAILURE", "serialized report integrity check failed")


def _ct_eq(a: str, b: str) -> bool:
    return hashlib.sha256(a.encode()).digest() == hashlib.sha256(b.encode()).digest()


def normalize_path(input: str, options=None) -> str:
    return _parse_and_normalize(input, options)["path"]


def resolve_path(base: str, input: str, options=None) -> str:
    _validate_path_input(base, "base")
    _validate_path_input(input, "input")
    opts = _validate_options(options)
    normalized_input = _normalize_separators(input, opts)
    input_descriptor = _root_descriptor(normalized_input)
    if input_descriptor["kind"] != "relative":
        return _parse_and_normalize(normalized_input, opts)["path"]
    _parse_and_normalize(normalized_input, opts)
    normalized_base = _parse_and_normalize(base, opts)
    if not normalized_base["absolute"]:
        _fail("MISSING_BASE", "base must be absolute for safe resolution")
    joined = f"{_format_descriptor(normalized_base['root'], normalized_base['segments'])}" \
             f"{'/' if not normalized_base['path'].endswith('/') else ''}{normalized_input}"
    return _parse_and_normalize(joined, opts)["path"]


def is_contained(path: str, root: str, options=None) -> dict:
    opts = _validate_options(options)
    candidate = _parse_and_normalize(path, opts)
    normalized_root = _parse_and_normalize(root, opts)
    contained = _contains_normalized(candidate, normalized_root, opts)
    reason = "segment-contained" if contained else (
        "root-mismatch" if not _same_root(candidate["root"], normalized_root["root"], opts["caseMode"])
        else "segment-outside")
    return {
        "format": FORMAT,
        "status": "contained" if contained else "outside",
        "path": candidate["path"],
        "root": normalized_root["path"],
        "reason": reason,
    }


def resolve_contained(root: str, input: str, options=None) -> str:
    opts = _validate_options(options)
    resolved = resolve_path(root, input, opts)
    report = is_contained(resolved, root, opts)
    if report["status"] != "contained":
        _fail("ROOT_MISMATCH" if report["reason"] == "root-mismatch" else "TRAVERSAL_ESCAPE",
              f"resolved path is outside root: {resolved}")
    return resolved


def compare_paths(left: str, right: str, options=None) -> int:
    opts = _validate_options(options)
    a = _parse_and_normalize(left, opts)
    b = _parse_and_normalize(right, opts)
    if not _same_root(a["root"], b["root"], opts["caseMode"]):
        return -1 if a["root"]["identity"] < b["root"]["identity"] else 1
    length = min(len(a["segments"]), len(b["segments"]))
    for i in range(length):
        comparison = _segment_compare(a["segments"][i], b["segments"][i], opts["caseMode"])
        if comparison != 0:
            return comparison
    if len(a["segments"]) == len(b["segments"]):
        return 0
    return -1 if len(a["segments"]) < len(b["segments"]) else 1


def serialize_report(report: dict) -> str:
    import json
    payload = _canonical_payload(report)
    if len(payload.encode("utf-8")) > MAX_SERIALIZED:
        _fail("LIMIT_EXCEEDED", f"report exceeds {MAX_SERIALIZED} bytes")
    return json.dumps({"format": FORMAT, "version": VERSION, "payload": payload,
                       "integrity": _integrity_digest(payload)})


def parse_report(serialized: str) -> dict:
    import json
    if not isinstance(serialized, str) or not serialized:
        _fail("MALFORMED_SERIALIZATION", "serialized report must be a non-empty string")
    if len(serialized.encode("utf-8")) > MAX_SERIALIZED:
        _fail("LIMIT_EXCEEDED", f"serialized report exceeds {MAX_SERIALIZED} bytes")
    try:
        envelope = json.loads(serialized)
    except Exception:
        _fail("MALFORMED_SERIALIZATION", "serialized report is invalid JSON")
    _validate_plain(envelope, "envelope")
    if envelope.get("format") != FORMAT or envelope.get("version") != VERSION \
            or not isinstance(envelope.get("payload"), str):
        _fail("MALFORMED_SERIALIZATION", "serialized report envelope is invalid")
    _verify_integrity(envelope["integrity"], _integrity_digest(envelope["payload"]))
    try:
        payload = json.loads(envelope["payload"])
    except Exception:
        _fail("MALFORMED_SERIALIZATION", "serialized report payload is invalid JSON")
    _validate_plain(payload, "payload")
    return payload


SAFE_PATH_RESOLVER_FORMAT = FORMAT
SAFE_PATH_RESOLVER_LIMITS = {
    "MAX_PATH": MAX_PATH,
    "MAX_SEGMENTS": MAX_SEGMENTS,
    "MAX_SYMLINK_DEPTH": MAX_SYMLINK_DEPTH,
    "MAX_SERIALIZED": MAX_SERIALIZED,
}

# camelCase aliases so the contract surface matches the canonical Node names
# exposed by the language-neutral conformance runner.
normalizePath = normalize_path
resolvePath = resolve_path
isContained = is_contained
resolveContained = resolve_contained
canonicalizePath = None  # async capability API; not part of the static contract surface
comparePaths = compare_paths
serializeReport = serialize_report
parseReport = parse_report
