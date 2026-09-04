package org.sovereign.safePathResolver

import java.security.MessageDigest
import java.nio.charset.StandardCharsets

/**
 * SPR1 — Safe Path Resolver.
 *
 * Native Kotlin/JVM implementation of the Sovereign `safe-path-resolver` contract
 * (canonical Node implementation: cubes/safe-path-resolver-containment-boundary/src/index.js).
 * This module is intentionally self-contained (JDK stdlib only) and mirrors the
 * canonical contract semantics so it can satisfy the shared conformance vectors exactly.
 */

class SafePathResolverError(val code: String, message: String) : Exception(message)

private const val FORMAT = "SPR1"
private const val VERSION = 1
private const val MAX_PATH = 32 * 1024
private const val MAX_SEGMENTS = 1024
private const val MAX_SYMLINK_DEPTH = 64
private const val MAX_SERIALIZED = 256 * 1024

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

data class SafePathResolverOptions(
    val separatorNormalization: Boolean = true,
    val normalizeDotSegments: Boolean = true,
    val caseMode: String = "sensitive",
    val preserveNamespace: Boolean = true,
    val maxSegments: Int = MAX_SEGMENTS,
    val symlinkPolicy: String = "lexical-only",
    val maxSymlinkDepth: Int = MAX_SYMLINK_DEPTH
)

// ---------------------------------------------------------------------------
// Internal descriptors
// ---------------------------------------------------------------------------

private data class RootDescriptor(
    val kind: String,
    val identity: String,
    val prefix: String,
    val rest: List<String>
)

private data class NormalizedPath(
    val root: RootDescriptor,
    val absolute: Boolean,
    val segments: List<String>,
    val path: String
)

// ---------------------------------------------------------------------------
// Public result shapes (match the canonical contract output verbatim)
// ---------------------------------------------------------------------------

data class ContainmentReport(
    val format: String = FORMAT,
    val status: String,
    val path: String,
    val root: String,
    val reason: String
)

data class PathResolution(
    val path: String,
    val metadata: PathMetadata
)

data class PathMetadata(
    val segments: List<String>,
    val depth: Int,
    val isAbsolute: Boolean,
    val hasTrailingSeparator: Boolean,
    val digest: String
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

private fun fail(code: String, message: String): Nothing =
    throw SafePathResolverError(code, message)

private fun validatePlain(value: Any?, label: String, seen: MutableSet<Any?> = mutableSetOf(), depth: Int = 0) {
    if (depth > 16) fail("LIMIT_EXCEEDED", "$label exceeds validation depth")
    if (value == null) return
    val type = value::class
    // Kotlin/JVM: only allow String, Number, Boolean, List, Map (plain data)
    when (value) {
        is Function<*> -> fail("CAPABILITY_RESULT_INVALID", "$label contains unsupported executable/non-data input")
        is Enum<*> -> fail("CAPABILITY_RESULT_INVALID", "$label contains unsupported value")
    }
    if (value is Number && value !is Float && value !is Double) {
        // finite integers are fine
    } else if (value is Float) {
        if (value.isNaN() || value.isInfinite()) fail("CAPABILITY_RESULT_INVALID", "$label contains a non-finite number")
    } else if (value is Double) {
        if (value.isNaN() || value.isInfinite()) fail("CAPABILITY_RESULT_INVALID", "$label contains a non-finite number")
    }
    if (value !is List<*> && value !is Map<*, *>) return
    if (seen.contains(value)) fail("CIRCULAR_INPUT", "$label is circular")
    seen.add(value)
    if (value is List<*>) {
        for (item in value) validatePlain(item, "$label[]", seen, depth + 1)
    } else if (value is Map<*, *>) {
        for ((k, v) in value) {
            if (k !is String) fail("CAPABILITY_RESULT_INVALID", "$label keys must be strings")
            validatePlain(v, "$label.$k", seen, depth + 1)
        }
    }
    seen.remove(value)
}

private fun validateOptions(options: SafePathResolverOptions): SafePathResolverOptions {
    if (options.separatorNormalization !is Boolean) fail("INVALID_PATH", "separatorNormalization must be boolean")
    if (options.normalizeDotSegments !is Boolean) fail("INVALID_PATH", "normalizeDotSegments must be boolean")
    if (options.caseMode !in listOf("sensitive", "insensitive")) fail("INVALID_PATH", "caseMode must be sensitive or insensitive")
    if (options.preserveNamespace !is Boolean) fail("INVALID_PATH", "preserveNamespace must be boolean")
    if (options.maxSegments !is Int || options.maxSegments < 1 || options.maxSegments > MAX_SEGMENTS)
        fail("LIMIT_EXCEEDED", "maxSegments must be between 1 and $MAX_SEGMENTS")
    if (options.symlinkPolicy !in listOf("lexical-only", "reject-symlink", "follow-contained"))
        fail("SYMLINK_REJECTED", "invalid symlink policy")
    if (options.maxSymlinkDepth !is Int || options.maxSymlinkDepth < 1 || options.maxSymlinkDepth > MAX_SYMLINK_DEPTH)
        fail("LIMIT_EXCEEDED", "maxSymlinkDepth must be between 1 and $MAX_SYMLINK_DEPTH")
    return options
}

private fun validatePathInput(value: String, label: String) {
    if (value::class != String::class) fail("INVALID_PATH", "$label must be a string")
    if (value.isEmpty() || value.contains('\u0000')) fail("INVALID_PATH", "$label must be non-empty and NUL-free")
    if (value.length > MAX_PATH) fail("LIMIT_EXCEEDED", "$label exceeds $MAX_PATH characters")
}

private fun normalizeSeparators(value: String, options: SafePathResolverOptions): String =
    if (options.separatorNormalization) value.replace('\\', '/') else value

private fun rootDescriptor(value: String): RootDescriptor {
    if (value.startsWith("//?/UNC/")) {
        val parts = value.substring("//?/UNC/".length).split('/')
        if (parts.size < 2 || parts[0].isEmpty() || parts[1].isEmpty()) fail("ROOT_MISMATCH", "invalid UNC namespace root")
        return RootDescriptor(
            kind = "namespace-unc",
            identity = "namespace-unc:${parts[0]}/${parts[1]}",
            prefix = "//?/UNC/${parts[0]}/${parts[1]}",
            rest = parts.drop(2)
        )
    }
    if (Regex("^//\\?/[A-Za-z]:(/|$)").containsMatchIn(value)) {
        val drive = value.substring(4, 6).uppercase()
        val restStart = if (value.length > 6 && value[6] == '/') 7 else 6
        return RootDescriptor(
            kind = "namespace-drive",
            identity = "namespace-drive:$drive",
            prefix = "//?/$drive",
            rest = value.substring(restStart).split('/')
        )
    }
    if (Regex("^[A-Za-z]:/").containsMatchIn(value)) {
        val drive = value.substring(0, 2).uppercase()
        return RootDescriptor(
            kind = "drive",
            identity = "drive:$drive",
            prefix = "$drive/",
            rest = value.substring(3).split('/')
        )
    }
    if (value.startsWith("//")) {
        val parts = value.substring(2).split('/')
        if (parts.size < 2 || parts[0].isEmpty() || parts[1].isEmpty()) fail("ROOT_MISMATCH", "invalid UNC root")
        return RootDescriptor(
            kind = "unc",
            identity = "unc:${parts[0]}/${parts[1]}",
            prefix = "//${parts[0]}/${parts[1]}",
            rest = parts.drop(2)
        )
    }
    if (value.startsWith("/")) {
        return RootDescriptor(
            kind = "posix",
            identity = "posix:/",
            prefix = "/",
            rest = value.substring(1).split('/')
        )
    }
    return RootDescriptor(
        kind = "relative",
        identity = "",
        prefix = "",
        rest = value.split('/')
    )
}

private fun normalizeSegments(rawSegments: List<String>, descriptor: RootDescriptor, options: SafePathResolverOptions): List<String> {
    if (rawSegments.size > options.maxSegments) fail("LIMIT_EXCEEDED", "path exceeds ${options.maxSegments} segments")
    val out = mutableListOf<String>()
    for (segment in rawSegments) {
        if (segment.isEmpty() || segment == ".") {
            if (!options.normalizeDotSegments) { out.add(segment); continue }
            continue
        }
        if (segment == "..") {
            if (!options.normalizeDotSegments) { out.add(segment); continue }
            if (out.isNotEmpty() && out.last() != "..") { out.removeAt(out.lastIndex); continue }
            if (descriptor.kind != "relative") fail("TRAVERSAL_ESCAPE", "path escapes an absolute root")
            fail("TRAVERSAL_ESCAPE", "relative path escapes its caller-defined scope")
        }
        out.add(segment)
        if (out.size > options.maxSegments) fail("LIMIT_EXCEEDED", "path exceeds ${options.maxSegments} segments")
    }
    return out
}

private fun formatDescriptor(descriptor: RootDescriptor, segments: List<String>): String {
    val body = segments.joinToString("/")
    return when (descriptor.kind) {
        "relative" -> if (body.isEmpty()) "." else body
        "posix" -> if (body.isEmpty()) "/" else "/$body"
        "drive" -> if (body.isEmpty()) descriptor.prefix else "${descriptor.prefix}$body"
        "unc" -> if (body.isEmpty()) descriptor.prefix else "${descriptor.prefix}/$body"
        "namespace-drive" -> if (body.isEmpty()) descriptor.prefix else "${descriptor.prefix}/$body"
        "namespace-unc" -> if (body.isEmpty()) descriptor.prefix else "${descriptor.prefix}/$body"
        else -> fail("ROOT_MISMATCH", "unsupported root descriptor")
    }
}

private fun parseAndNormalize(value: String, options: SafePathResolverOptions): NormalizedPath {
    validatePathInput(value, "path")
    val opts = validateOptions(options)
    val normalizedInput = normalizeSeparators(value, opts)
    if (Regex("^[A-Za-z]:[^/]").containsMatchIn(normalizedInput)) fail("ROOT_MISMATCH", "drive-relative paths such as C:foo are rejected")
    val descriptor = rootDescriptor(normalizedInput)
    val segments = normalizeSegments(descriptor.rest, descriptor, opts)
    return NormalizedPath(
        root = descriptor,
        absolute = descriptor.kind != "relative",
        segments = segments,
        path = formatDescriptor(descriptor, segments)
    )
}

private fun normalizeCase(value: String, caseMode: String): String =
    if (caseMode == "insensitive") value.lowercase(java.util.Locale.US) else value

private fun sameRoot(left: RootDescriptor, right: RootDescriptor, caseMode: String): Boolean =
    normalizeCase(left.identity, caseMode) == normalizeCase(right.identity, caseMode)

private fun segmentCompare(left: String, right: String, caseMode: String): Int {
    val a = normalizeCase(left, caseMode)
    val b = normalizeCase(right, caseMode)
    return a.compareTo(b)
}

private fun containsNormalized(candidate: NormalizedPath, root: NormalizedPath, options: SafePathResolverOptions): Boolean {
    if (!sameRoot(candidate.root, root.root, options.caseMode) || !candidate.absolute || !root.absolute) return false
    if (candidate.segments.size < root.segments.size) return false
    for (i in root.segments.indices) {
        if (segmentCompare(candidate.segments[i], root.segments[i], options.caseMode) != 0) return false
    }
    return true
}

private fun canonicalPayload(value: Any?): String {
    validatePlain(value, "payload")
    return canonicalJson(value)
}

private fun canonicalJson(value: Any?): String {
    return when (value) {
        null -> "null"
        is String -> JSONObject.quote(value)
        is Number -> value.toString()
        is Boolean -> value.toString()
        is Enum<*> -> JSONObject.quote(value.name)
        is List<*> -> "[${value.map { canonicalJson(it) }.joinToString(",")}]"
        is Map<*, *> -> {
            val sorted = value.entries.sortedBy { it.key.toString() }
            "{${sorted.map { "\"${it.key}\":${canonicalJson(it.value)}" }.joinToString(",")}}"
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
            if (props.isEmpty()) fail("CAPABILITY_RESULT_INVALID", "unsupported value type in serialization: ${value::class.qualifiedName}")
            val sorted = props.entries.sortedBy { it.key }
            "{${sorted.map { "\"${it.key}\":${canonicalJson(it.value)}" }.joinToString(",")}}"
        }
    }
}

private fun integrityDigest(payload: String): String {
    val data = "$FORMAT|$VERSION|$payload"
    val digest = MessageDigest.getInstance("SHA-256")
    val hash = digest.digest(data.toByteArray(StandardCharsets.UTF_8))
    return hash.joinToString("") { "%02x".format(it) }
}

private fun verifyIntegrity(expected: String, actual: String) {
    if (expected !is String || !Regex("^[0-9a-f]{64}$").matches(expected)) {
        fail("INTEGRITY_FAILURE", "serialized report integrity is invalid")
    }
    val a = hexToBytes(expected)
    val b = hexToBytes(actual)
    if (a.contentEquals(b)) return
    fail("INTEGRITY_FAILURE", "serialized report integrity check failed")
}

private fun hexToBytes(hex: String): ByteArray {
    val len = hex.length
    val bytes = ByteArray(len / 2)
    for (i in 0 until len step 2) {
        bytes[i / 2] = ((hex[i].digitToInt(16) shl 4) + hex[i + 1].digitToInt(16)).toByte()
    }
    return bytes
}

// ---------------------------------------------------------------------------
// Public API (matches canonical Node exports exactly)
// ---------------------------------------------------------------------------

object SafePathResolver {

    // Non-default overloads: exact arity so the language-neutral conformance runner
    // (which dispatches by reflected method name + argument count) can bind them.
    @JvmStatic fun normalizePath(input: String): String = normalizePath(input, SafePathResolverOptions())
    @JvmStatic fun resolvePath(base: String, input: String): String = resolvePath(base, input, SafePathResolverOptions())
    @JvmStatic fun isContained(path: String, root: String): ContainmentReport = isContained(path, root, SafePathResolverOptions())
    @JvmStatic fun resolveContained(root: String, input: String): String = resolveContained(root, input, SafePathResolverOptions())
    @JvmStatic fun comparePaths(left: String, right: String): Int = comparePaths(left, right, SafePathResolverOptions())

    @JvmStatic fun normalizePath(input: String, options: SafePathResolverOptions = SafePathResolverOptions()): String =
        parseAndNormalize(input, options).path

    @JvmStatic fun resolvePath(base: String, input: String, options: SafePathResolverOptions = SafePathResolverOptions()): String {
        validatePathInput(base, "base")
        validatePathInput(input, "input")
        val opts = validateOptions(options)
        val normalizedInput = normalizeSeparators(input, opts)
        val inputDescriptor = rootDescriptor(normalizedInput)
        if (inputDescriptor.kind != "relative") return parseAndNormalize(normalizedInput, opts).path
        parseAndNormalize(normalizedInput, opts)
        val normalizedBase = parseAndNormalize(base, opts)
        if (!normalizedBase.absolute) fail("MISSING_BASE", "base must be absolute for safe resolution")
        val combined = "${formatDescriptor(normalizedBase.root, normalizedBase.segments)}${if (normalizedBase.path.endsWith("/")) "" else "/"}$normalizedInput"
        return parseAndNormalize(combined, opts).path
    }

    @JvmStatic fun isContained(path: String, root: String, options: SafePathResolverOptions = SafePathResolverOptions()): ContainmentReport {
        val opts = validateOptions(options)
        val candidate = parseAndNormalize(path, opts)
        val normalizedRoot = parseAndNormalize(root, opts)
        val contained = containsNormalized(candidate, normalizedRoot, opts)
        val reason = if (contained) "segment-contained"
        else if (!sameRoot(candidate.root, normalizedRoot.root, opts.caseMode)) "root-mismatch"
        else "segment-outside"
        return ContainmentReport(
            status = if (contained) "contained" else "outside",
            path = candidate.path,
            root = normalizedRoot.path,
            reason = reason
        )
    }

    @JvmStatic fun resolveContained(root: String, input: String, options: SafePathResolverOptions = SafePathResolverOptions()): String {
        val opts = validateOptions(options)
        val resolved = resolvePath(root, input, opts)
        val report = isContained(resolved, root, opts)
        if (report.status != "contained") {
            val code = if (report.reason == "root-mismatch") "ROOT_MISMATCH" else "TRAVERSAL_ESCAPE"
            fail(code, "resolved path is outside root: $resolved")
        }
        return resolved
    }

    @JvmStatic fun comparePaths(left: String, right: String, options: SafePathResolverOptions = SafePathResolverOptions()): Int {
        val opts = validateOptions(options)
        val a = parseAndNormalize(left, opts)
        val b = parseAndNormalize(right, opts)
        if (!sameRoot(a.root, b.root, opts.caseMode)) return a.root.identity.compareTo(b.root.identity)
        val length = minOf(a.segments.size, b.segments.size)
        for (i in 0 until length) {
            val comparison = segmentCompare(a.segments[i], b.segments[i], opts.caseMode)
            if (comparison != 0) return comparison
        }
        return a.segments.size.compareTo(b.segments.size)
    }

    @JvmStatic fun serializeReport(report: Any?): String {
        val payload = canonicalPayload(report)
        if (payload.toByteArray(StandardCharsets.UTF_8).size > MAX_SERIALIZED) {
            fail("LIMIT_EXCEEDED", "report exceeds $MAX_SERIALIZED bytes")
        }
        val envelope = """{"format":"$FORMAT","version":$VERSION,"payload":${JSONObject.quote(payload)},"integrity":"${integrityDigest(payload)}"}"""
        return envelope
    }

    @JvmStatic fun parseReport(serialized: String): Map<String, Any?> {
        if (serialized !is String || serialized.isEmpty()) fail("MALFORMED_SERIALIZATION", "serialized report must be a non-empty string")
        if (serialized.toByteArray(StandardCharsets.UTF_8).size > MAX_SERIALIZED) {
            fail("LIMIT_EXCEEDED", "serialized report exceeds $MAX_SERIALIZED bytes")
        }
        val envelope = parseJsonObject(serialized)
            ?: fail("MALFORMED_SERIALIZATION", "serialized report is invalid JSON")
        validatePlain(envelope, "envelope")
        if (envelope["format"] != FORMAT || envelope["version"] != VERSION || envelope["payload"] !is String) {
            fail("MALFORMED_SERIALIZATION", "serialized report envelope is invalid")
        }
        verifyIntegrity(envelope["integrity"] as String, integrityDigest(envelope["payload"] as String))
        val payload = parseJson(envelope["payload"] as String)
            ?: fail("MALFORMED_SERIALIZATION", "serialized report payload is invalid JSON")
        validatePlain(payload, "payload")
        @Suppress("UNCHECKED_CAST")
        return payload as Map<String, Any?>
    }

    @JvmStatic fun SAFE_PATH_RESOLVER_FORMAT(): String = FORMAT

    @JvmStatic fun SAFE_PATH_RESOLVER_LIMITS(): Map<String, Int> = mapOf(
        "MAX_PATH" to MAX_PATH,
        "MAX_SEGMENTS" to MAX_SEGMENTS,
        "MAX_SYMLINK_DEPTH" to MAX_SYMLINK_DEPTH,
        "MAX_SERIALIZED" to MAX_SERIALIZED
    )
}

// ---------------------------------------------------------------------------
// Minimal JSON support (stdlib-only, no external deps)
// ---------------------------------------------------------------------------

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
                else -> {
                    if (ch.code < 0x20) sb.append("\\u%04x".format(ch.code))
                    else sb.append(ch)
                }
            }
        }
        sb.append('"')
        return sb.toString()
    }
}

private fun parseJsonObject(s: String): MutableMap<String, Any?>? {
    val trimmed = s.trim()
    if (!trimmed.startsWith("{")) return null
    val map = mutableMapOf<String, Any?>()
    var i = 1
    while (i < trimmed.length) {
        // skip whitespace and commas
        while (i < trimmed.length && (trimmed[i] == ',' || trimmed[i].isWhitespace())) i++
        if (i < trimmed.length && trimmed[i] == '}') break
        if (trimmed[i] != '"') return null
        val keyStart = i + 1
        val keyEnd = trimmed.indexOf('"', keyStart)
        if (keyEnd < 0) return null
        val key = trimmed.substring(keyStart, keyEnd)
        i = keyEnd + 1
        while (i < trimmed.length && trimmed[i].isWhitespace()) i++
        if (i >= trimmed.length || trimmed[i] != ':') return null
        i++
        while (i < trimmed.length && trimmed[i].isWhitespace()) i++
        val (value, next) = parseJsonValue(trimmed, i)
        map[key] = value
        i = next
    }
    return map
}

private fun parseJson(s: String): Any? {
    val (value, _) = parseJsonValue(s.trim(), 0)
    return value
}

private fun parseJsonValue(s: String, start: Int): Pair<Any?, Int> {
    var i = start
    while (i < s.length && s[i].isWhitespace()) i++
    if (i >= s.length) return null to i
    return when (s[i]) {
        '{' -> {
            val obj = parseJsonObjectFrom(s, i)
            obj.first to obj.second
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
        't', 'f' -> {
            if (s.startsWith("true", i)) true to (i + 4)
            else if (s.startsWith("false", i)) false to (i + 5)
            else null to i
        }
        'n' -> {
            if (s.startsWith("null", i)) null to (i + 4)
            else null to i
        }
        else -> {
            // number
            var j = i
            while (j < s.length && (s[j].isDigit() || s[j] in "+-.eE".toSet())) j++
            val numStr = s.substring(i, j)
            val num = numStr.toIntOrNull() ?: numStr.toDoubleOrNull()
            num to j
        }
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

private fun parseJsonObjectFrom(s: String, start: Int): Pair<MutableMap<String, Any?>, Int> {
    val map = mutableMapOf<String, Any?>()
    var i = start + 1
    while (i < s.length) {
        while (i < s.length && (s[i] == ',' || s[i].isWhitespace())) i++
        if (i < s.length && s[i] == '}') { i++; break }
        if (s[i] != '"') return map to i
        val keyStart = i + 1
        val keyEnd = s.indexOf('"', keyStart)
        if (keyEnd < 0) return map to i
        val key = s.substring(keyStart, keyEnd)
        i = keyEnd + 1
        while (i < s.length && s[i].isWhitespace()) i++
        if (i >= s.length || s[i] != ':') return map to i
        i++
        while (i < s.length && s[i].isWhitespace()) i++
        val (value, next) = parseJsonValue(s, i)
        map[key] = value
        i = next
    }
    return map to i
}
