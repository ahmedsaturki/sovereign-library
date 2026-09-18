package org.sovereign.runtimeCapabilityInspector

import java.io.File

/**
 * RCI1 — Runtime Capability Inspector.
 *
 * Native Kotlin/JVM implementation of the Sovereign `runtime-capability-inspector` contract.
 *
 * Contract ambiguity resolution (per the Kotlin/JVM finalization directive, and consistent
 * with the authoritative conformance-passing native precedent — the Python port):
 *
 *   1. `runtime.node` is OPTIONAL RUNTIME METADATA, NOT a required Node.js runtime probe.
 *      It is populated ONLY when the caller explicitly supplies `nodeVersion`. It is NEVER
 *      synthesized from `java.version` or any other JVM property. On a JVM without an explicit
 *      Node version, `runtime.node` is null. This is runtime-neutral and matches the Python port.
 *
 *   2. Failure codes follow the native precedent (Python port), which the canonical vectors
 *      actually assert:
 *        OS_FAMILY_UNSUPPORTED, ARCHITECTURE_UNSUPPORTED, NODE_MAJOR_TOO_LOW,
 *        NODE_MAJOR_TOO_HIGH, CPU_COUNT_TOO_LOW, MEMORY_TOO_LOW, EXECUTABLE_MISSING,
 *        DUPLICATE_REQUIREMENT, INVALID_REQUIREMENT, INVALID_REQUIREMENTS, INVALID_RUNTIME,
 *        INVALID_SNAPSHOT, INVALID_EXECUTABLE, INVALID_ENV.
 *      (Raw Node's OS_MISMATCH is not used by the conformance vectors; the native precedent wins.)
 *
 *   3. Serialization uses plain deterministic JSON (canonical key order) with a SHA-256 checksum
 *      envelope, mirroring the canonical contract `serializeRuntimeReport`/`parseRuntimeReport`.
 *      No external runtime dependency. No Runtime.exec (no deadlock / unconsumed streams).
 *
 * This module depends only on the JDK stdlib, keeping it Android-applicable and dependency-free.
 */

// ---------------------------------------------------------------------------
// Public result/error types
// ---------------------------------------------------------------------------

open class RuntimeCapabilityError(val code: String, message: String) : Exception(message) {
    override fun toString(): String = "RuntimeCapabilityError($code, $message)"
}

data class NodeVersion(
    val version: String? = null,
    val major: Int? = null,
    val minor: Int? = null,
    val patch: Int? = null
)

data class Platform(
    val os: String,
    val release: String,
    val architecture: String,
    val endianness: String
)

data class Runtime(
    val node: NodeVersion? = null
)

data class Resources(
    val cpuCount: Int,
    val totalMemoryBytes: Long
)

data class ExecutableResult(
    val name: String,
    val available: Boolean
)

data class Environment(
    val pathConfigured: Boolean,
    val executableResults: List<ExecutableResult>
)

data class Snapshot(
    val format: String = RCI1.FORMAT,
    val mode: String = "runtime_capability_snapshot",
    val platform: Platform,
    val runtime: Runtime,
    val resources: Resources,
    val environment: Environment
)

data class Failure(
    val code: String,
    val message: String
)

data class Verdict(
    val format: String = RCI1.FORMAT,
    val mode: String = "runtime_capability_verdict",
    val passed: Boolean,
    val failures: List<Failure>
)

// ---------------------------------------------------------------------------
// Limits (mirror canonical Node constants)
// ---------------------------------------------------------------------------

private const val MAX_EXECUTABLES = 64
private const val MAX_PATH_ENTRIES = 128
private const val MAX_LIST = 32
private const val MAX_NAME = 256
private const val MAX_PAYLOAD = 64 * 1024
private const val MAX_DEPTH = 12
private val EXECUTABLE_NAME = Regex("^[A-Za-z0-9][A-Za-z0-9._:+@/-]{0,255}\$")

private val OS_FAMILIES = setOf("linux", "darwin", "win32", "freebsd", "openbsd", "sunos", "aix", "android", "other")
private val ARCHITECTURES = setOf("x64", "arm64", "arm", "ia32", "ppc64", "ppc64le", "s390x", "riscv64", "loong64", "other")

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

private fun fail(code: String, message: String): Nothing =
    throw RuntimeCapabilityError(code, message)

private fun <T> checkSeen(seen: MutableSet<Any>, value: T, block: () -> T): T {
    if (value is List<*> || value is Map<*, *>) {
        if (!seen.add(value as Any)) fail("CIRCULAR_INPUT", "input contains a circular reference")
        try {
            return block()
        } finally {
            seen.remove(value as Any)
        }
    }
    return block()
}

private fun validateSafe(value: Any?, label: String, seen: MutableSet<Any> = mutableSetOf(), depth: Int = 0) {
    if (depth > MAX_DEPTH) fail("DEPTH_LIMIT", "$label exceeds maximum depth")
    if (value == null) return
    when (value) {
        is Function<*> -> fail("UNSUPPORTED_VALUE", "$label contains an unsupported value (function)")
        is Enum<*> -> fail("UNSUPPORTED_VALUE", "$label contains an unsupported value (enum)")
    }
    if (value !is List<*> && value !is Map<*, *>) return
    checkSeen(seen, value) {
        if (value is List<*>) {
            value.forEachIndexed { i, item -> validateSafe(item, "$label[$i]", seen, depth + 1) }
        } else if (value is Map<*, *>) {
            for ((k, v) in value) {
                if (k !is String) fail("UNSUPPORTED_VALUE", "$label keys must be strings")
                validateSafe(v, "$label.$k", seen, depth + 1)
            }
        }
    }
}

/**
 * Normalize an OS family name. Accepts both the canonical Node-style family names
 * (win32/darwin/linux/...) and the JVM's human-readable `os.name` values, mapping the
 * latter explicitly to the contract family. Never invents a Node version — only the
 * family label is normalized. Unknown values collapse to "other".
 */
private fun osFamilyFromJvm(value: String): String {
    val v = value.lowercase()
    return when {
        v == "win32" || v.startsWith("windows") -> "win32"
        v == "darwin" || v == "mac os x" || v.startsWith("mac") -> "darwin"
        v == "linux" -> "linux"
        v == "freebsd" -> "freebsd"
        v == "openbsd" -> "openbsd"
        v == "sunos" || v == "solaris" -> "sunos"
        v == "aix" -> "aix"
        v == "android" -> "android"
        else -> "other"
    }
}

/**
 * Normalize a JVM `os.arch` value to the contract architecture vocabulary explicitly.
 * This is a faithful label mapping (amd64 -> x64, aarch64 -> arm64, ...), not a Node
 * version synthesis.
 */
private fun archFromJvm(value: String): String = when (value) {
    "x64", "x86_64", "amd64" -> "x64"
    "arm64", "aarch64" -> "arm64"
    "arm" -> "arm"
    "ia32", "x86", "i386", "i486", "i586", "i686" -> "ia32"
    "ppc64" -> "ppc64"
    "ppc64le" -> "ppc64le"
    "s390x" -> "s390x"
    "riscv64" -> "riscv64"
    "loong64", "loongarch64" -> "loong64"
    else -> "other"
}

private fun parseNodeVersion(value: String): NodeVersion {
    val match = Regex("^v?(\\d+)\\.(\\d+)\\.(\\d+)").find(value)
        ?: fail("INVALID_RUNTIME", "Node.js runtime version is malformed: $value")
    return NodeVersion(
        version = "v${match.groupValues[1]}.${match.groupValues[2]}.${match.groupValues[3]}",
        major = match.groupValues[1].toInt(),
        minor = match.groupValues[2].toInt(),
        patch = match.groupValues[3].toInt()
    )
}

private fun stringValue(value: String, label: String, max: Int = MAX_NAME) {
    if (value.isEmpty() || value.length > max) fail("LIMIT_EXCEEDED", "$label exceeds $max characters")
}

private fun windowsCandidates(name: String, pathExt: String?, platform: String): List<String> {
    if (platform != "win32") return listOf(name)
    if (Regex("\\.[A-Za-z0-9]+\$").containsMatchIn(name)) return listOf(name)
    val extensions = (pathExt ?: ".COM;.EXE;.BAT;.CMD").split(';').filter { it.isNotBlank() }
    return extensions.map { "$name$it" }
}

private fun executableAvailable(name: String, pathEntries: List<String>, pathExt: String?, platform: String): Boolean {
    val candidates = windowsCandidates(name, pathExt, platform)
    for (directory in pathEntries) {
        for (candidate in candidates) {
            val full = if (directory.isNotEmpty()) "$directory/$candidate" else candidate
            val f = File(full)
            try {
                if (f.exists() && f.canRead() && (f.canExecute() || platform == "win32")) return true
            } catch (_: SecurityException) { /* inaccessible */ }
        }
    }
    return false
}

private fun normalizeExecutableRequests(requests: List<Any>, label: String): List<String> {
    val names = requests.map { req ->
        when (req) {
            is String -> req
            is Map<*, *> -> {
                val n = req["name"]
                if (n !is String) fail("INVALID_EXECUTABLE", "$label entry must be a string or {name}")
                n
            }
            else -> fail("INVALID_EXECUTABLE", "$label entry must be a string or {name}")
        }.also { stringValue(it, "$label entry") }
    }
    if (!EXECUTABLE_NAME.matches(names.firstOrNull() ?: "")) {
        // re-validated per entry below; this branch only guards empty input shape
    }
    names.forEach { if (!EXECUTABLE_NAME.matches(it)) fail("INVALID_EXECUTABLE", "$label entry is malformed: $it") }
    val unique = names.toSet().toList().sorted()
    if (unique.size != names.size) fail("DUPLICATE_REQUIREMENT", "$label contains duplicates")
    if (unique.size > MAX_EXECUTABLES) fail("LIMIT_EXCEEDED", "$label exceeds $MAX_EXECUTABLES entries")
    return unique
}

private fun capturePaths(envPath: Any?, platform: String): List<String> {
    val raw = if (envPath is String) envPath else ""
    val entries = raw.split(if (platform == "win32") ';' else ':').filter { it.isNotBlank() }
    if (entries.size > MAX_PATH_ENTRIES) fail("LIMIT_EXCEEDED", "PATH exceeds $MAX_PATH_ENTRIES entries")
    return entries
}

// ---------------------------------------------------------------------------
// Deterministic serialization (canonical key order + SHA-256 checksum)
// ---------------------------------------------------------------------------

private fun canonicalJson(value: Any?): String = canonicalJson(value, 0)

private fun canonicalJson(value: Any?, depth: Int): String {
    if (depth > 24) fail("UNSUPPORTED_VALUE", "serialization exceeded depth limit at ${value?.let { it::class.qualifiedName }}")
    return when (value) {
        null -> "null"
        is String -> JSONObject.quote(value)
        is Number -> value.toString()
        is Boolean -> value.toString()
        is Enum<*> -> JSONObject.quote(value.name)
        is List<*> -> "[${value.map { canonicalJson(it, depth + 1) }.joinToString(",")}]"
        is Map<*, *> -> {
            val sorted = value.entries.sortedBy { it.key.toString() }
            "{${sorted.map { "\"${it.key}\":${canonicalJson(it.value, depth + 1)}" }.joinToString(",")}}"
        }
        else -> {
            val props = value::class.java.methods
                .filter { it.parameterCount == 0 && it.name !in setOf("hashCode", "toString", "equals", "copy", "wait", "getClass", "notify", "notifyAll") && !it.name.startsWith("component") }
                .associate { method ->
                    val raw = method.name
                    val key = when {
                        raw.startsWith("get") && raw.length > 3 -> raw[3].lowercase() + raw.substring(4)
                        raw.startsWith("is") && raw.length > 2 -> raw[2].lowercase() + raw.substring(3)
                        else -> raw
                    }
                    key to method.invoke(value)
                }
            if (props.isEmpty()) fail("UNSUPPORTED_VALUE", "unsupported value type in serialization: ${value::class.qualifiedName}")
            val sorted = props.entries.sortedBy { it.key }
            "{${sorted.map { "\"${it.key}\":${canonicalJson(it.value, depth + 1)}" }.joinToString(",")}}"
        }
    }
}

private fun sha256Hex(text: String): String {
    val digest = java.security.MessageDigest.getInstance("SHA-256")
    val bytes = digest.digest(text.toByteArray(Charsets.UTF_8))
    return bytes.joinToString("") { "%02x".format(it) }
}

private object JSONObject {
    fun quote(s: String): String {
        val sb = StringBuilder()
        sb.append('"')
        for (ch in s) {
            when (ch) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                '\b' -> sb.append("\\b")
                '\u000c' -> sb.append("\\f")
                else -> if (ch.code < 0x20) sb.append("\\u%04x".format(ch.code)) else sb.append(ch)
            }
        }
        sb.append('"')
        return sb.toString()
    }
}

private fun parseJsonString(s: String, start: Int): Pair<String?, Int> {
    val sb = StringBuilder()
    var j = start + 1
    while (j < s.length) {
        val c = s[j]
        if (c == '\\') {
            j++
            sb.append(when (s[j]) {
                '"' -> '"'; '\\' -> '\\'; '/' -> '/'; 'b' -> '\b'; 'f' -> '\u000c'
                'n' -> '\n'; 'r' -> '\r'; 't' -> '\t'
                'u' -> s.substring(j + 1, j + 5).toInt(16).toChar().also { j += 4 }
                else -> c
            })
            j++
        } else if (c == '"') {
            return sb.toString() to (j + 1)
        } else {
            sb.append(c)
            j++
        }
    }
    return null to start
}

private fun parseJsonObject(s: String): Pair<MutableMap<String, Any?>, Int>? {
    val t = s.trim()
    if (!t.startsWith("{")) return null
    val map = mutableMapOf<String, Any?>()
    var i = 1
    while (i < t.length) {
        while (i < t.length && (t[i] == ',' || t[i].isWhitespace())) i++
        if (i < t.length && t[i] == '}') return map to (i + 1)
        if (t[i] != '"') return null
        val keyStart = i + 1
        val keyEnd = t.indexOf('"', keyStart)
        if (keyEnd < 0) return null
        val key = t.substring(keyStart, keyEnd)
        i = keyEnd + 1
        while (i < t.length && t[i].isWhitespace()) i++
        if (i >= t.length || t[i] != ':') return null
        i++
        while (i < t.length && t[i].isWhitespace()) i++
        val (value, next) = parseJsonValue(t, i)
        map[key] = value
        i = next
    }
    return null
}

private fun parseJson(s: String): Any? = parseJsonValue(s.trim(), 0).first

private fun parseJsonValue(s: String, start: Int): Pair<Any?, Int> {
    var i = start
    while (i < s.length && s[i].isWhitespace()) i++
    if (i >= s.length) return null to i
    return when (s[i]) {
        '{' -> {
            val parsed = parseJsonObject(s.substring(i)) ?: return (null to i)
            parsed.first to (i + parsed.second)
        }
        '[' -> {
            val arr = mutableListOf<Any?>()
            i++
            while (i < s.length) {
                while (i < s.length && (s[i] == ',' || s[i].isWhitespace())) i++
                if (i < s.length && s[i] == ']') { i++; break }
                val (v, n) = parseJsonValue(s, i)
                arr.add(v)
                i = n
            }
            arr to i
        }
        '"' -> parseJsonString(s, i)
        't', 'f' -> if (s.startsWith("true", i)) true to (i + 4) else if (s.startsWith("false", i)) false to (i + 5) else null to i
        'n' -> if (s.startsWith("null", i)) null to (i + 4) else null to i
        else -> {
            var j = i
            while (j < s.length && (s[j].isDigit() || s[j] in "+-.eE".toSet())) j++
            val numStr = s.substring(i, j)
            val num = numStr.toIntOrNull() ?: numStr.toLongOrNull() ?: numStr.toDoubleOrNull()
            num to j
        }
    }
}

// ---------------------------------------------------------------------------
// Public API (matches canonical Node + native-precedent export surface)
// ---------------------------------------------------------------------------

class RuntimeCapabilityInspector {

    @Suppress("UNCHECKED_CAST")
    fun inspectRuntime(options: Map<String, Any> = emptyMap()): Snapshot {
        validateSafe(options, "options")
        val executables = normalizeExecutableRequests(options.getOrDefault("executables", emptyList<Any>()) as List<Any>, "executables")
        val env = (options.getOrDefault("env", null) ?: System.getenv()) as? Map<String, Any>
            ?: fail("INVALID_ENV", "env must be a plain object")
        validateSafe(env, "env")

        val platform = osFamilyFromJvm(options.getOrDefault("platform", System.getProperty("os.name")) as String)
        val architecture = archFromJvm(options.getOrDefault("arch", System.getProperty("os.arch")) as String)
        val release = (options.getOrDefault("release", System.getProperty("os.version")) as String).also { stringValue(it, "release", 1024) }
        val endianness = if (System.getProperty("os.arch").contains("64")) "64-bit" else "32-bit"

        // runtime.node is OPTIONAL metadata: only populated when the caller supplies nodeVersion.
        val nodeRuntime: NodeVersion? = (options["nodeVersion"] as? String)?.let { parseNodeVersion(it) }

        val envPath = env["PATH"] ?: env["Path"] ?: ""
        val pathExt = env["PATHEXT"] as? String
        val pathEntries = capturePaths(envPath, platform)

        val cpuCount = (options.getOrDefault("cpuCount", null) as? Int)
            ?: java.lang.Runtime.getRuntime().availableProcessors().coerceAtLeast(1)
        if (cpuCount < 1 || cpuCount > 65536) fail("INVALID_RUNTIME", "cpuCount is invalid")

        val memoryBytes = (options.getOrDefault("totalMemoryBytes", null) as? Long)
            ?: (try { java.lang.management.ManagementFactory.getOperatingSystemMXBean()
                .let { it as? com.sun.management.OperatingSystemMXBean }?.totalPhysicalMemorySize ?: 0L }
            catch (_: Throwable) { 0L })
        if (memoryBytes < 0) fail("INVALID_RUNTIME", "totalMemoryBytes is invalid")

        val executableResults = executables.map { name ->
            ExecutableResult(name, executableAvailable(name, pathEntries, pathExt, platform))
        }

        return Snapshot(
            platform = Platform(os = platform, release = release, architecture = architecture, endianness = endianness),
            runtime = Runtime(node = nodeRuntime),
            resources = Resources(cpuCount = cpuCount, totalMemoryBytes = memoryBytes),
            environment = Environment(pathConfigured = pathEntries.isNotEmpty(), executableResults = executableResults)
        )
    }

    @Suppress("UNCHECKED_CAST")
    fun evaluateRuntimeRequirements(snapshot: Snapshot?, requirements: Map<String, Any>): Verdict {
        if (snapshot == null || snapshot.format != RCI1.FORMAT || snapshot.mode != "runtime_capability_snapshot") {
            fail("INVALID_SNAPSHOT", "invalid runtime snapshot")
        }
        validateSafe(snapshot, "snapshot")
        val normalized = normalizeRequirements(requirements)
        val failures = mutableListOf<Failure>()

        if (normalized.os.isNotEmpty() && snapshot.platform.os !in normalized.os) {
            failures.add(Failure("OS_FAMILY_UNSUPPORTED", "OS family unsupported: expected ${normalized.os}, actual ${snapshot.platform.os}"))
        }
        if (normalized.architectures.isNotEmpty() && snapshot.platform.architecture !in normalized.architectures) {
            failures.add(Failure("ARCHITECTURE_UNSUPPORTED", "Architecture unsupported: expected ${normalized.architectures}, actual ${snapshot.platform.architecture}"))
        }
        val major = snapshot.runtime.node?.major
        if (normalized.nodeMajorMin != null && major != null && major < normalized.nodeMajorMin) {
            failures.add(Failure("NODE_MAJOR_TOO_LOW", "Node major too low: minimum ${normalized.nodeMajorMin}, actual $major"))
        }
        if (normalized.nodeMajorMax != null && major != null && major > normalized.nodeMajorMax) {
            failures.add(Failure("NODE_MAJOR_TOO_HIGH", "Node major too high: maximum ${normalized.nodeMajorMax}, actual $major"))
        }
        if (normalized.minCpuCount != null && snapshot.resources.cpuCount < normalized.minCpuCount) {
            failures.add(Failure("CPU_COUNT_TOO_LOW", "CPU count too low: minimum ${normalized.minCpuCount}, actual ${snapshot.resources.cpuCount}"))
        }
        if (normalized.minMemoryBytes != null && snapshot.resources.totalMemoryBytes < normalized.minMemoryBytes) {
            failures.add(Failure("MEMORY_TOO_LOW", "Memory too low: minimum ${normalized.minMemoryBytes}, actual ${snapshot.resources.totalMemoryBytes}"))
        }
        val executableMap = snapshot.environment.executableResults.associate { it.name to it.available }
        for (name in normalized.requiredExecutables) {
            if (executableMap[name] != true) failures.add(Failure("EXECUTABLE_MISSING", "Executable '$name' not found in PATH"))
        }
        return Verdict(passed = failures.isEmpty(), failures = failures)
    }

    @Suppress("UNCHECKED_CAST")
    private fun normalizeRequirements(requirements: Map<String, Any>): NormalizedRequirements {
        validateSafe(requirements, "requirements")
        val osFamilies = normalizeRequirementList(requirements.getOrDefault("os", emptyList<Any>()) as List<Any>, "requirements.os") { value ->
            val normalized = osFamilyFromJvm(value)
            if (normalized == "other" && value != "other") fail("INVALID_REQUIREMENT", "requirements.os contains unsupported OS: $value")
            normalized
        }
        val architectures = normalizeRequirementList(requirements.getOrDefault("architectures", emptyList<Any>()) as List<Any>, "requirements.architectures") { value ->
            val normalized = archFromJvm(value)
            if (normalized == "other" && value != "other") fail("INVALID_REQUIREMENT", "requirements.architectures contains unsupported architecture: $value")
            normalized
        }
        val requiredExecutables = normalizeExecutableRequests(requirements.getOrDefault("requiredExecutables", emptyList<Any>()) as List<Any>, "requiredExecutables")
        val nodeMajorMin = numericOrNull(requirements["nodeMajorMin"], "requirements.nodeMajorMin")
        val nodeMajorMax = numericOrNull(requirements["nodeMajorMax"], "requirements.nodeMajorMax")
        if (nodeMajorMin != null && nodeMajorMax != null && nodeMajorMin > nodeMajorMax) {
            fail("INVALID_REQUIREMENT", "nodeMajorMin exceeds nodeMajorMax")
        }
        return NormalizedRequirements(
            os = osFamilies,
            architectures = architectures,
            nodeMajorMin = nodeMajorMin,
            nodeMajorMax = nodeMajorMax,
            requiredExecutables = requiredExecutables,
            minCpuCount = numericOrNull(requirements["minCpuCount"], "requirements.minCpuCount"),
            minMemoryBytes = longOrNull(requirements["minMemoryBytes"], "requirements.minMemoryBytes")
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun normalizeRequirementList(value: List<Any>, label: String, mapper: (String) -> String): List<String> {
        if (value.size > MAX_LIST) fail("LIMIT_EXCEEDED", "$label exceeds $MAX_LIST entries")
        val items = value.map { item ->
            val raw = when (item) {
                is String -> item.also { stringValue(it, label, 32) }
                is Map<*, *> -> {
                    val n = item["name"]
                    if (n !is String) fail("INVALID_REQUIREMENT", "$label entry must be a string or {name}")
                    n.also { stringValue(it, label, 32) }
                }
                else -> fail("INVALID_REQUIREMENT", "$label entry must be a string or {name}")
            }
            mapper(raw)
        }
        val unique = items.toSet().toList().sorted()
        if (unique.size != items.size) fail("DUPLICATE_REQUIREMENT", "$label contains duplicates")
        return unique
    }

    private fun numericOrNull(value: Any?, label: String): Int? {
        if (value == null) return null
        val n = when (value) {
            is Int -> value
            is Long -> if (value in 0..Int.MAX_VALUE) value.toInt() else fail("INVALID_REQUIREMENT", "$label must be a non-negative safe integer")
            else -> fail("INVALID_REQUIREMENT", "$label must be a non-negative safe integer")
        }
        if (n < 0) fail("INVALID_REQUIREMENT", "$label must be a non-negative safe integer")
        return n
    }

    private fun longOrNull(value: Any?, label: String): Long? {
        if (value == null) return null
        val n = when (value) {
            is Long -> value
            is Int -> value.toLong()
            else -> fail("INVALID_REQUIREMENT", "$label must be a non-negative safe integer")
        }
        if (n < 0) fail("INVALID_REQUIREMENT", "$label must be a non-negative safe integer")
        return n
    }

    fun serializeRuntimeReport(report: Any): String {
        validateSafe(report, "report")
        val payload = canonicalJson(report)
        if (payload.toByteArray(Charsets.UTF_8).size > MAX_PAYLOAD) fail("LIMIT_EXCEEDED", "payload exceeds $MAX_PAYLOAD bytes")
        val checksum = sha256Hex(payload)
        return canonicalJson(mapOf("format" to RCI1.FORMAT, "checksum" to checksum, "payload" to payload))
    }

    @Suppress("UNCHECKED_CAST")
    fun parseRuntimeReport(serialized: String): Map<String, Any?> {
        if (serialized.isEmpty()) fail("MALFORMED_SERIALIZATION", "serialized report must be a non-empty string")
        val envelope = parseJsonObject(serialized)?.first ?: fail("MALFORMED_SERIALIZATION", "serialized report is invalid JSON")
        validateSafe(envelope, "envelope")
        if (envelope["format"] != RCI1.FORMAT) fail("INVALID_FORMAT", "unsupported report format")
        val payload = envelope["payload"] as? String ?: fail("MALFORMED_SERIALIZATION", "envelope payload is invalid")
        stringValue(payload, "envelope.payload", MAX_PAYLOAD)
        val checksum = envelope["checksum"] as? String ?: fail("MALFORMED_SERIALIZATION", "envelope checksum is invalid")
        stringValue(checksum, "envelope.checksum", 64)
        if (!Regex("^[0-9a-f]{64}\$").matches(checksum)) fail("INVALID_CHECKSUM", "checksum is malformed")
        if (sha256Hex(payload) != checksum) fail("INTEGRITY_MISMATCH", "runtime report checksum mismatch")
        val parsed = parseJson(payload) as? Map<String, Any?> ?: fail("MALFORMED_SERIALIZATION", "report payload is invalid JSON")
        validateSafe(parsed, "payload")
        return parsed
    }
}

private data class NormalizedRequirements(
    val os: List<String>,
    val architectures: List<String>,
    val nodeMajorMin: Int?,
    val nodeMajorMax: Int?,
    val requiredExecutables: List<String>,
    val minCpuCount: Int?,
    val minMemoryBytes: Long?
)

object RCI1 {
    const val FORMAT = "RCI1"
    const val VERSION = 1
    val RUNTIME_CAPABILITY_FORMAT: String = FORMAT
    val RUNTIME_OS_FAMILIES: List<String> = OS_FAMILIES.toList()
    val RUNTIME_ARCHITECTURES: List<String> = ARCHITECTURES.toList()
}

fun main(args: Array<String>) {
    println("Runtime Capability Inspector - Kotlin/JVM implementation")
    println("Version: ${RCI1.VERSION}")
    println("Format: ${RCI1.FORMAT}")
    val inspector = RuntimeCapabilityInspector()
    val snapshot = inspector.inspectRuntime()
    println("Platform: ${snapshot.platform.os} ${snapshot.platform.architecture}")
    println("CPU Count: ${snapshot.resources.cpuCount}")
    println("Memory: ${snapshot.resources.totalMemoryBytes} bytes")
}
