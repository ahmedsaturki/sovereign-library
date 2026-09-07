"""Native tests for the SPR1 safe-path-resolver Python port (contract-grounded)."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sovereign_safe_path_resolver import (  # noqa: E402
    resolveContained,
    isContained,
    normalizePath,
    resolveContained as resolve_contained,
    SafePathResolverError,
    SAFE_PATH_RESOLVER_FORMAT,
    SAFE_PATH_RESOLVER_LIMITS,
)


def test_resolve_contained_relative():
    assert resolveContained("/a", "b/c") == "/a/b/c"


def test_is_contained_true():
    report = isContained("/a/b/c", "/a")
    assert report["status"] == "contained"
    assert report["format"] == "SPR1"
    assert report["reason"] == "segment-contained"


def test_normalize_dot_segments():
    assert normalizePath("a/./b/../c") == "a/c"


def test_traversal_blocked():
    try:
        resolveContained("/a", "../etc/passwd")
        assert False, "expected SafePathResolverError"
    except SafePathResolverError as err:
        assert err.code == "TRAVERSAL_ESCAPE"


def test_absolute_escape_blocked():
    try:
        resolveContained("/a", "/etc/passwd")
        assert False, "expected SafePathResolverError"
    except SafePathResolverError as err:
        assert err.code == "TRAVERSAL_ESCAPE"


def test_format_and_limits():
    assert SAFE_PATH_RESOLVER_FORMAT == "SPR1"
    assert set(SAFE_PATH_RESOLVER_LIMITS.keys()) == {
        "MAX_PATH", "MAX_SEGMENTS", "MAX_SYMLINK_DEPTH", "MAX_SERIALIZED"
    }
