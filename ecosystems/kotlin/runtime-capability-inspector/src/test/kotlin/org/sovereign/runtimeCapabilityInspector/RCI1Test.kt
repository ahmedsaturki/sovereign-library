package org.sovereign.runtimeCapabilityInspector

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import org.sovereign.conformance.runConformanceVectors

class RuntimeCapabilityInspectorTest {

    private val inspector = RuntimeCapabilityInspector()

    @Test
    fun test_inspect_runtime_basic() {
        val snapshot = inspector.inspectRuntime()
        assertNotNull(snapshot)
        assertEquals("runtime_capability_snapshot", snapshot.mode)
        assertNotNull(snapshot.platform.os)
        assertNotNull(snapshot.platform.architecture)
        // runtime.node is OPTIONAL metadata: null when no explicit nodeVersion supplied.
        assertNull(snapshot.runtime.node)
        assertNotNull(snapshot.resources)
        assertNotNull(snapshot.environment)
    }

    @Test
    fun test_inspect_runtime_with_explicit_node_version() {
        val snapshot = inspector.inspectRuntime(mapOf("nodeVersion" to "v18.0.0"))
        assertNotNull(snapshot.runtime.node)
        assertEquals(18, snapshot.runtime.node!!.major)
        assertEquals("v18.0.0", snapshot.runtime.node!!.version)
    }

    @Test
    fun test_inspect_runtime_with_custom_options() {
        val options = mapOf(
            "platform" to "linux",
            "arch" to "x64",
            "cpuCount" to 4,
            "totalMemoryBytes" to 1024L * 1024 * 1024,
            "path" to "/usr/local/bin:/usr/bin",
            "executables" to listOf("java", "python")
        )
        val snapshot = inspector.inspectRuntime(options)
        assertNotNull(snapshot)
        assertEquals("linux", snapshot.platform.os)
        assertEquals("x64", snapshot.platform.architecture)
        assertEquals(4, snapshot.resources.cpuCount)
        assertEquals(1073741824L, snapshot.resources.totalMemoryBytes)
    }

    @Test
    fun test_evaluate_requirements_pass() {
        val snapshot = inspector.inspectRuntime(mapOf(
            "platform" to "linux",
            "arch" to "x64",
            "nodeVersion" to "v18.0.0",
            "cpuCount" to 8,
            "totalMemoryBytes" to 8192L * 1024 * 1024
        ))
        val requirements = mapOf(
            "os" to listOf("linux"),
            "architectures" to listOf("x64"),
            "nodeMajorMin" to 16,
            "nodeMajorMax" to 20,
            "minCpuCount" to 4,
            "minMemoryBytes" to 4096L * 1024 * 1024
        )
        val verdict = inspector.evaluateRuntimeRequirements(snapshot, requirements)
        assertTrue(verdict.passed)
        assertTrue(verdict.failures.isEmpty())
    }

    @Test
    fun test_evaluate_requirements_fail_os() {
        val snapshot = inspector.inspectRuntime(mapOf("platform" to "darwin", "arch" to "arm64"))
        val requirements = mapOf("os" to listOf("linux"))
        val verdict = inspector.evaluateRuntimeRequirements(snapshot, requirements)
        assertFalse(verdict.passed)
        assertTrue(verdict.failures.any { it.code == "OS_FAMILY_UNSUPPORTED" })
    }

    @Test
    fun test_evaluate_requirements_fail_arch() {
        val snapshot = inspector.inspectRuntime(mapOf("platform" to "linux", "arch" to "x64"))
        val requirements = mapOf("architectures" to listOf("arm64"))
        val verdict = inspector.evaluateRuntimeRequirements(snapshot, requirements)
        assertFalse(verdict.passed)
        assertTrue(verdict.failures.any { it.code == "ARCHITECTURE_UNSUPPORTED" })
    }

    @Test
    fun test_evaluate_requirements_fail_node_version() {
        val snapshot = inspector.inspectRuntime(mapOf(
            "platform" to "linux", "arch" to "x64", "nodeVersion" to "v14.0.0"))
        val requirements = mapOf("nodeMajorMin" to 16)
        val verdict = inspector.evaluateRuntimeRequirements(snapshot, requirements)
        assertFalse(verdict.passed)
        assertTrue(verdict.failures.any { it.code == "NODE_MAJOR_TOO_LOW" })
    }

    @Test
    fun test_evaluate_requirements_fail_cpu() {
        val snapshot = inspector.inspectRuntime(mapOf("platform" to "linux", "arch" to "x64", "cpuCount" to 2))
        val requirements = mapOf("minCpuCount" to 4)
        val verdict = inspector.evaluateRuntimeRequirements(snapshot, requirements)
        assertFalse(verdict.passed)
        assertTrue(verdict.failures.any { it.code == "CPU_COUNT_TOO_LOW" })
    }

    @Test
    fun test_evaluate_requirements_fail_memory() {
        val snapshot = inspector.inspectRuntime(mapOf(
            "platform" to "linux", "arch" to "x64", "totalMemoryBytes" to 1024L * 1024 * 1024))
        val requirements = mapOf("minMemoryBytes" to 4096L * 1024 * 1024)
        val verdict = inspector.evaluateRuntimeRequirements(snapshot, requirements)
        assertFalse(verdict.passed)
        assertTrue(verdict.failures.any { it.code == "MEMORY_TOO_LOW" })
    }

    @Test
    fun test_evaluate_requirements_fail_executable() {
        val snapshot = inspector.inspectRuntime(mapOf(
            "platform" to "linux", "arch" to "x64", "executables" to listOf("java", "python")))
        val requirements = mapOf("requiredExecutables" to listOf("nonexistent_executable_12345"))
        val verdict = inspector.evaluateRuntimeRequirements(snapshot, requirements)
        assertFalse(verdict.passed)
        assertTrue(verdict.failures.any { it.code == "EXECUTABLE_MISSING" })
    }

    @Test
    fun test_evaluate_requirements_invalid_node_version() {
        var thrown = false
        try {
            inspector.inspectRuntime(mapOf(
                "platform" to "linux", "arch" to "x64", "nodeVersion" to "invalid-version"))
        } catch (e: RuntimeCapabilityError) {
            thrown = true
            assertEquals("INVALID_RUNTIME", e.code)
        }
        assertTrue(thrown)
    }

    @Test
    fun test_evaluate_requirements_invalid_requirement() {
        val snapshot = inspector.inspectRuntime()
        var thrown = false
        try {
            inspector.evaluateRuntimeRequirements(snapshot, mapOf("nodeMajorMin" to 20, "nodeMajorMax" to 16))
        } catch (e: RuntimeCapabilityError) {
            thrown = true
            assertEquals("INVALID_REQUIREMENT", e.code)
        }
        assertTrue(thrown)
    }

    @Test
    fun test_evaluate_requirements_unsupported_os_rejected() {
        val snapshot = inspector.inspectRuntime()
        var thrown = false
        try {
            inspector.evaluateRuntimeRequirements(snapshot, mapOf("os" to listOf("nonexistent-os")))
        } catch (e: RuntimeCapabilityError) {
            thrown = true
            assertEquals("INVALID_REQUIREMENT", e.code)
        }
        assertTrue(thrown)
    }

    @Test
    fun test_evaluate_requirements_duplicate_executables() {
        val snapshot = inspector.inspectRuntime()
        var thrown = false
        try {
            inspector.evaluateRuntimeRequirements(snapshot, mapOf("requiredExecutables" to listOf("java", "java")))
        } catch (e: RuntimeCapabilityError) {
            thrown = true
            assertEquals("DUPLICATE_REQUIREMENT", e.code)
        }
        assertTrue(thrown)
    }

    @Test
    fun test_serialize_roundtrip() {
        val snapshot = inspector.inspectRuntime(mapOf(
            "platform" to "linux", "arch" to "x64", "nodeVersion" to "v18.0.0",
            "cpuCount" to 4, "totalMemoryBytes" to 4096L * 1024 * 1024))
        val serialized = inspector.serializeRuntimeReport(snapshot)
        assertTrue(serialized.contains("\"RCI1\""))
        assertTrue(serialized.contains("checksum"))
        val parsed = inspector.parseRuntimeReport(serialized)
        assertEquals("RCI1", parsed["format"])
        assertEquals("runtime_capability_snapshot", parsed["mode"])
    }

    @Test
    fun test_constants() {
        assertEquals("RCI1", RCI1.RUNTIME_CAPABILITY_FORMAT)
        assertEquals(9, RCI1.RUNTIME_OS_FAMILIES.size)
        assertEquals(10, RCI1.RUNTIME_ARCHITECTURES.size)
    }

    @Test
    fun conformance_vectors() {
        assertTrue(
            runConformanceVectors("vectors.runtime-capability-inspector.json", Rci1Conformance),
            "RCI1 conformance vectors must all pass"
        )
    }
}
