package org.sovereign.safePathResolver.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/** Runs inside Android ART on the emulator; no Android API is required by SPR1 itself. */
class SafePathResolverAndroidDeviceTest {

    @Test
    fun normalize_and_contain_on_art() {
        assertEquals("/data/app/data/file.txt", normalizePath("/data/app/./data/file.txt"))
        assertEquals("/data/app/config/settings.json", resolveContained("/data/app", "config/./settings.json"))
    }

    @Test
    fun traversal_escape_is_blocked_on_art() {
        val ex = assertThrows(SafePathResolverError::class.java) {
            resolveContained("/data/app", "../../etc/passwd")
        }
        assertEquals("TRAVERSAL_ESCAPE", ex.code)
    }

    @Test
    fun serializer_is_deterministic_on_art() {
        val report = isContained("/data/app/config", "/data/app")
        val first = serializeReport(report)
        val second = serializeReport(report)
        assertEquals(first, second)
        assertTrue(first.contains("SPR1"))
        assertTrue(first.contains("integrity"))
    }
}
