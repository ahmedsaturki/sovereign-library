package org.sovereign.safePathResolver

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import org.sovereign.conformance.runConformanceVectors

class SafePathResolverTest {

    @Test
    fun test_normalize_path_basic() {
        val result = SafePathResolver.normalizePath("/a/b/../c")
        assertEquals("/a/c", result)
    }

    @Test
    fun test_is_contained_true() {
        val report = SafePathResolver.isContained("/a/b/c", "/a")
        assertEquals("contained", report.status)
        assertEquals("segment-contained", report.reason)
    }

    @Test
    fun test_is_contained_false() {
        val report = SafePathResolver.isContained("/a/b/c", "/x")
        assertEquals("outside", report.status)
        assertEquals("segment-outside", report.reason)
    }

    @Test
    fun test_normalize_path_absolute() {
        val result = SafePathResolver.normalizePath("/a/./b")
        assertEquals("/a/b", result)
    }

    @Test
    fun test_normalize_path_traversal_blocked() {
        val result = SafePathResolver.normalizePath("/a/../etc/passwd")
        assertEquals("/etc/passwd", result)
    }

    @Test
    fun test_normalize_path_with_options() {
        val options = SafePathResolverOptions(caseMode = "insensitive")
        // caseMode governs segment comparison, not output case-folding (per canonical contract).
        val result = SafePathResolver.normalizePath("/A/B/C", options)
        assertEquals("/A/B/C", result)
    }

    @Test
    fun test_resolve_path_relative() {
        val result = SafePathResolver.resolvePath("/a/b", "c/../d")
        assertEquals("/a/b/d", result)
    }

    @Test
    fun test_resolve_path_absolute_input() {
        val result = SafePathResolver.resolvePath("/a/b", "/x/y")
        assertEquals("/x/y", result)
    }

    @Test
    fun test_resolve_path_missing_base() {
        try {
            SafePathResolver.resolvePath("relative/base", "input")
            fail("Should have thrown an exception")
        } catch (e: SafePathResolverError) {
            assertEquals("MISSING_BASE", e.code)
        }
    }

    @Test
    fun test_resolve_contained() {
        val result = SafePathResolver.resolveContained("/root", "sub/path")
        assertEquals("/root/sub/path", result)
    }

    @Test
    fun test_resolve_contained_escape() {
        try {
            SafePathResolver.resolveContained("/root", "../../../etc/passwd")
            fail("Should have thrown an exception")
        } catch (e: SafePathResolverError) {
            assertEquals("TRAVERSAL_ESCAPE", e.code)
        }
    }

    @Test
    fun test_compare_paths_same() {
        assertEquals(0, SafePathResolver.comparePaths("/a/b/c", "/a/b/c"))
    }

    @Test
    fun test_compare_paths_different() {
        assertEquals(-1, SafePathResolver.comparePaths("/a/b", "/a/c"))
    }

    @Test
    fun test_compare_paths_case_insensitive() {
        val options = SafePathResolverOptions(caseMode = "insensitive")
        assertEquals(0, SafePathResolver.comparePaths("/A/B", "/a/b", options))
    }

    @Test
    fun test_serialize_parse_report() {
        val report = SafePathResolver.isContained("/a/b/c", "/a")
        val serialized = SafePathResolver.serializeReport(report)
        assertTrue(serialized.contains("\"SPR1\""))
        assertTrue(serialized.contains("integrity"))

        val parsed = SafePathResolver.parseReport(serialized)
        assertEquals("SPR1", parsed["format"])
        assertEquals("contained", parsed["status"])
        assertEquals("/a/b/c", parsed["path"])
        assertEquals("/a", parsed["root"])
    }

    @Test
    fun test_parse_report_invalid() {
        try {
            SafePathResolver.parseReport("invalid json")
            fail("Should have thrown an exception")
        } catch (e: SafePathResolverError) {
            assertEquals("MALFORMED_SERIALIZATION", e.code)
        }
    }

    @Test
    fun test_format_constant() {
        assertEquals("SPR1", SafePathResolver.SAFE_PATH_RESOLVER_FORMAT())
    }

    @Test
    fun test_limits_constant() {
        val limits = SafePathResolver.SAFE_PATH_RESOLVER_LIMITS()
        assertTrue(limits.containsKey("MAX_PATH"))
        assertTrue(limits.containsKey("MAX_SEGMENTS"))
        assertTrue(limits.containsKey("MAX_SYMLINK_DEPTH"))
        assertTrue(limits.containsKey("MAX_SERIALIZED"))
    }

    @Test
    fun test_windows_paths() {
        val result = SafePathResolver.normalizePath("C:/Users/Name/../Documents")
        assertTrue(result.startsWith("C:"))
    }

    @Test
    fun test_drive_relative_rejected() {
        try {
            SafePathResolver.normalizePath("C:foo")
            fail("Should have thrown an exception")
        } catch (e: SafePathResolverError) {
            assertEquals("ROOT_MISMATCH", e.code)
        }
    }

    @Test
    fun test_segment_limit() {
        val options = SafePathResolverOptions(maxSegments = 5)
        try {
            SafePathResolver.normalizePath("/a/b/c/d/e/f", options)
            fail("Should have thrown an exception")
        } catch (e: SafePathResolverError) {
            assertEquals("LIMIT_EXCEEDED", e.code)
        }
    }

    @Test
    fun test_normalize_dot_segments_disabled() {
        val options = SafePathResolverOptions(normalizeDotSegments = false)
        val result = SafePathResolver.normalizePath("/a/b/./c", options)
        assertEquals("/a/b/./c", result)
    }

    @Test
    fun test_separator_normalization_disabled() {
        val options = SafePathResolverOptions(separatorNormalization = false)
        val result = SafePathResolver.normalizePath("a\\b\\c", options)
        assertEquals("a\\b\\c", result)
    }

    @Test
    fun conformance_vectors() {
        assertTrue(
            runConformanceVectors("vectors.safe-path-resolver.json", SafePathResolver),
            "SPR1 conformance vectors must all pass"
        )
    }
}
