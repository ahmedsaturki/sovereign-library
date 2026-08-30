package org.sovereign.safePathResolver.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.sovereign.conformance.AndroidConformanceRunner

class SafePathResolverAndroidTest {

    @Test
    fun normalize_relative() {
        assertEquals("a/c", normalizePath("a/./b/../c"))
    }

    @Test
    fun resolveContained_relative() {
        assertEquals("/a/b/c", resolveContained("/a", "b/c"))
    }

    @Test
    fun isContained_true() {
        val r = isContained("/a/b/c", "/a")
        assertEquals("contained", r.status)
        assertEquals("segment-contained", r.reason)
        assertEquals("/a/b/c", r.path)
        assertEquals("/a", r.root)
    }

    @Test
    fun isContained_outside() {
        val r = isContained("/etc/passwd", "/a")
        assertEquals("outside", r.status)
        assertEquals("segment-outside", r.reason)
    }

    @Test
    fun resolveContained_traversal_blocked() {
        val ex = assertThrows(SafePathResolverError::class.java) { resolveContained("/a", "../etc/passwd") }
        assertEquals("TRAVERSAL_ESCAPE", ex.code)
    }

    @Test
    fun resolveContained_absolute_escape_blocked() {
        val ex = assertThrows(SafePathResolverError::class.java) { resolveContained("/a", "/etc/passwd") }
        assertEquals("TRAVERSAL_ESCAPE", ex.code)
    }

    @Test
    fun drive_relative_rejected() {
        val ex = assertThrows(SafePathResolverError::class.java) { normalizePath("C:foo") }
        assertEquals("ROOT_MISMATCH", ex.code)
    }

    @Test
    fun normalize_dot_segments_disabled() {
        assertEquals(
            "/a/b/./c",
            normalizePath("/a/b/./c", SafePathResolverOptions(normalizeDotSegments = false))
        )
    }

    @Test
    fun normalize_options_insensitive_keeps_case() {
        assertEquals(
            "/A/B/C",
            normalizePath("/A/B/C", SafePathResolverOptions(caseMode = "insensitive"))
        )
    }

    @Test
    fun separator_normalization() {
        assertEquals("/a/b/c", normalizePath("\\a\\b\\c"))
    }

    @Test
    fun empty_path_rejected() {
        assertThrows(SafePathResolverError::class.java) { normalizePath("") }
    }

    @Test
    fun format_constant() {
        assertEquals("SPR1", SAFE_PATH_RESOLVER_FORMAT())
    }

    @Test
    fun limits_present() {
        val limits = SAFE_PATH_RESOLVER_LIMITS()
        assertTrue(limits.containsKey("MAX_PATH"))
        assertTrue(limits.containsKey("MAX_SEGMENTS"))
        assertTrue(limits.containsKey("MAX_SYMLINK_DEPTH"))
        assertTrue(limits.containsKey("MAX_SERIALIZED"))
    }

    @Test
    fun serialize_roundtrip_deterministic() {
        val report = isContained("/a/b/c", "/a")
        val serialized = serializeReport(report)
        assertTrue(serialized.contains("\"SPR1\""))
        assertTrue(serialized.contains("integrity"))
        assertEquals(serialized, serializeReport(report))
    }

    @Test
    fun conformance_vectors() {
        val (pass, fail) = AndroidConformanceRunner.runSuite("vectors.safe-path-resolver.json")
        assertEquals("SPR1 conformance must be 7/7", 0, fail)
        assertEquals(7, pass)
    }
}
