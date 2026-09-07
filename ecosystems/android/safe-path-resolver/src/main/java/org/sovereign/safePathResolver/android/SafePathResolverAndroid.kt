package org.sovereign.safePathResolver.android

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Locale

class SafePathResolverError(val code: String, message: String) : Exception(message)

data class SafePathResolverOptions(
    val separatorNormalization: Boolean = true,
    val normalizeDotSegments: Boolean = true,
    val caseMode: String = "sensitive",
    val preserveNamespace: Boolean = true,
    val maxSegments: Int = MAX_SEGMENTS,
    val symlinkPolicy: String = "lexical-only",
    val maxSymlinkDepth: Int = MAX_SYMLINK_DEPTH
)

data class ContainmentReport(
    val format: String,
    val status: String,
    val path: String,
    val root: String,
    val reason: String
)

private const val FORMAT = "SPR1"
private const val VERSION = 1
private const val MAX_PATH = 32 * 1024
private const val MAX_SEGMENTS = 1024
private const val MAX_SYMLINK_DEPTH = 64
private const val MAX_SERIALIZED = 256 * 1024

private fun fail(code: String, message: String): Nothing =
    throw SafePathResolverError(code, message)

private fun validatePathInput(value: String, label: String = "path") {
    if (value.isEmpty() || value.indexOf('\u0000') >= 0) fail("INVALID_PATH", "$label must be non-empty and NUL-free")
    if (value.length > MAX_PATH) fail("LIMIT_EXCEEDED", "$label exceeds $MAX_PATH characters")
}

private fun validateOptions(options: SafePathResolverOptions): SafePathResolverOptions {
    if (options.caseMode !in listOf("sensitive", "insensitive")) {
        fail("INVALID_PATH", "caseMode must be sensitive or insensitive")
    }
    if (options.maxSegments !in 1..MAX_SEGMENTS) {
        fail("LIMIT_EXCEEDED", "maxSegments must be between 1 and $MAX_SEGMENTS")
    }
    if (options.symlinkPolicy !in listOf("lexical-only", "reject-symlink", "follow-contained")) {
        fail("SYMLINK_REJECTED", "invalid symlink policy")
    }
    if (options.maxSymlinkDepth !in 1..MAX_SYMLINK_DEPTH) {
        fail("LIMIT_EXCEEDED", "maxSymlinkDepth must be between 1 and $MAX_SYMLINK_DEPTH")
    }
    return options
}

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

private fun normalizeSeparators(value: String, options: SafePathResolverOptions): String =
    if (options.separatorNormalization) value.replace('\\', '/') else value

private fun rootDescriptor(value: String): RootDescriptor {
    if (value.startsWith("//?/UNC/")) {
        val parts = value.substring("//?/UNC/".length).split('/')
        if (parts.size < 2 || parts[0].isEmpty() || parts[1].isEmpty()) {
            fail("ROOT_MISMATCH", "invalid UNC namespace root")
        }
        return RootDescriptor(
            kind = "namespace-unc",
            identity = "namespace-unc:${parts[0]}/${parts[1]}",
            prefix = "//?/UNC/${parts[0]}/${parts[1]}",
            rest = parts.drop(2)
        )
    }

    if (Regex("^//\\?/[A-Za-z]:(/|$)").containsMatchIn(value)) {
        val drive = value.substring(4, 6).uppercase(Locale.US)
        val restStart = if (value.length > 6 && value[6] == '/') 7 else 6
        return RootDescriptor(
            kind = "namespace-drive",
            identity = "namespace-drive:$drive",
            prefix = "//?/$drive",
            rest = value.substring(restStart).split('/')
        )
    }

    if (Regex("^[A-Za-z]:/").containsMatchIn(value)) {
        val drive = value.substring(0, 2).uppercase(Locale.US)
        return RootDescriptor(
            kind = "drive",
            identity = "drive:$drive",
            prefix = "$drive/",
            rest = value.substring(3).split('/')
        )
    }

    if (value.startsWith("//")) {
        val parts = value.substring(2).split('/')
        if (parts.size < 2 || parts[0].isEmpty() || parts[1].isEmpty()) {
            fail("ROOT_MISMATCH", "invalid UNC root")
        }
        return RootDescriptor(
            kind = "unc",
            identity = "unc:${parts[0]}/${parts[1]}",
            prefix = "//${parts[0]}/${parts[1]}",
            rest = parts.drop(2)
        )
    }

    if (value.startsWith('/')) {
        return RootDescriptor("posix", "posix:/", "/", value.substring(1).split('/'))
    }

    return RootDescriptor("relative", "", "", value.split('/'))
}

private fun normalizeSegments(
    rawSegments: List<String>,
    descriptor: RootDescriptor,
    options: SafePathResolverOptions
): List<String> {
    if (rawSegments.size > options.maxSegments) {
        fail("LIMIT_EXCEEDED", "path exceeds ${options.maxSegments} segments")
    }

    val out = mutableListOf<String>()
    for (segment in rawSegments) {
        if (segment.isEmpty() || segment == ".") {
            if (!options.normalizeDotSegments) out.add(segment)
            continue
        }

        if (segment == "..") {
            if (!options.normalizeDotSegments) {
                out.add(segment)
                continue
            }
            if (out.isNotEmpty() && out.last() != "..") {
                out.removeAt(out.lastIndex)
                continue
            }
            if (descriptor.kind != "relative") {
                fail("TRAVERSAL_ESCAPE", "path escapes an absolute root")
            }
            fail("TRAVERSAL_ESCAPE", "relative path escapes its caller-defined scope")
        }

        out.add(segment)
        if (out.size > options.maxSegments) {
            fail("LIMIT_EXCEEDED", "path exceeds ${options.maxSegments} segments")
        }
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
    validatePathInput(value)
    val opts = validateOptions(options)
    val normalizedInput = normalizeSeparators(value, opts)
    if (Regex("^[A-Za-z]:[^/]").containsMatchIn(normalizedInput)) {
        fail("ROOT_MISMATCH", "drive-relative paths such as C:foo are rejected")
    }
    val descriptor = rootDescriptor(normalizedInput)
    val segments = normalizeSegments(descriptor.rest, descriptor, opts)
    val path = formatDescriptor(descriptor, segments)
    if (path.length > MAX_PATH) fail("LIMIT_EXCEEDED", "normalized path exceeds $MAX_PATH characters")
    return NormalizedPath(
        root = descriptor,
        absolute = descriptor.kind != "relative",
        segments = segments,
        path = path
    )
}

private fun normalizeCase(value: String, caseMode: String): String =
    if (caseMode == "insensitive") value.lowercase(Locale.US) else value

private fun sameRoot(left: RootDescriptor, right: RootDescriptor, caseMode: String): Boolean =
    normalizeCase(left.identity, caseMode) == normalizeCase(right.identity, caseMode)

private fun segmentCompare(left: String, right: String, caseMode: String): Int {
    val a = normalizeCase(left, caseMode)
    val b = normalizeCase(right, caseMode)
    return a.compareTo(b)
}

private fun containsNormalized(
    candidate: NormalizedPath,
    root: NormalizedPath,
    options: SafePathResolverOptions
): Boolean {
    if (!sameRoot(candidate.root, root.root, options.caseMode) || !candidate.absolute || !root.absolute) return false
    if (candidate.segments.size < root.segments.size) return false
    for (i in root.segments.indices) {
        if (segmentCompare(candidate.segments[i], root.segments[i], options.caseMode) != 0) return false
    }
    return true
}

/** Normalize a path string with default options. */
fun normalizePath(input: String): String = normalizePath(input, SafePathResolverOptions())

/** Normalize a path string. */
fun normalizePath(input: String, options: SafePathResolverOptions): String =
    parseAndNormalize(input, options).path

/** Resolve [input] against absolute [base]. */
fun resolvePath(base: String, input: String): String = resolvePath(base, input, SafePathResolverOptions())

/** Resolve [input] against absolute [base]. */
fun resolvePath(base: String, input: String, options: SafePathResolverOptions): String {
    validatePathInput(base, "base")
    validatePathInput(input, "input")
    val opts = validateOptions(options)
    val normalizedInput = normalizeSeparators(input, opts)
    val inputDescriptor = rootDescriptor(normalizedInput)
    if (inputDescriptor.kind != "relative") return parseAndNormalize(normalizedInput, opts).path

    parseAndNormalize(normalizedInput, opts)
    val normalizedBase = parseAndNormalize(base, opts)
    if (!normalizedBase.absolute) fail("MISSING_BASE", "base must be absolute for safe resolution")

    val combined = "${normalizedBase.path}${if (normalizedBase.path.endsWith('/')) "" else "/"}$normalizedInput"
    return parseAndNormalize(combined, opts).path
}

/** Decide whether [path] is contained within [root]. */
fun isContained(path: String, root: String): ContainmentReport =
    isContained(path, root, SafePathResolverOptions())

/** Decide whether [path] is contained within [root]. */
fun isContained(path: String, root: String, options: SafePathResolverOptions): ContainmentReport {
    val opts = validateOptions(options)
    val candidate = parseAndNormalize(path, opts)
    val normalizedRoot = parseAndNormalize(root, opts)
    val contained = containsNormalized(candidate, normalizedRoot, opts)
    val reason = when {
        contained -> "segment-contained"
        !sameRoot(candidate.root, normalizedRoot.root, opts.caseMode) -> "root-mismatch"
        else -> "segment-outside"
    }
    return ContainmentReport(
        format = FORMAT,
        status = if (contained) "contained" else "outside",
        path = candidate.path,
        root = normalizedRoot.path,
        reason = reason
    )
}

/** Resolve [input] against [root] and fail closed if the result escapes. */
fun resolveContained(root: String, input: String): String =
    resolveContained(root, input, SafePathResolverOptions())

/** Resolve [input] against [root] and fail closed if the result escapes. */
fun resolveContained(root: String, input: String, options: SafePathResolverOptions): String {
    val opts = validateOptions(options)
    val resolved = resolvePath(root, input, opts)
    val report = isContained(resolved, root, opts)
    if (report.status != "contained") {
        val code = if (report.reason == "root-mismatch") "ROOT_MISMATCH" else "TRAVERSAL_ESCAPE"
        fail(code, "resolved path is outside root: $resolved")
    }
    return resolved
}

/** Lexicographically compare two normalized paths. */
fun comparePaths(left: String, right: String): Int =
    comparePaths(left, right, SafePathResolverOptions())

/** Lexicographically compare two normalized paths. */
fun comparePaths(left: String, right: String, options: SafePathResolverOptions): Int {
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

private fun jsonQuote(value: String): String {
    val out = StringBuilder(value.length + 2)
    out.append('"')
    for (ch in value) {
        when (ch) {
            '"' -> out.append("\\\"")
            '\\' -> out.append("\\\\")
            '\n' -> out.append("\\n")
            '\r' -> out.append("\\r")
            '\t' -> out.append("\\t")
            '\b' -> out.append("\\b")
            '\u000c' -> out.append("\\f")
            else -> if (ch.code < 0x20) out.append("\\u%04x".format(ch.code)) else out.append(ch)
        }
    }
    out.append('"')
    return out.toString()
}

private fun canonicalJson(value: Any?): String = when (value) {
    null -> "null"
    is String -> jsonQuote(value)
    is Boolean -> value.toString()
    is Byte, is Short, is Int, is Long -> value.toString()
    is Float -> {
        if (value.isNaN() || value.isInfinite()) fail("CAPABILITY_RESULT_INVALID", "payload contains a non-finite number")
        value.toString()
    }
    is Double -> {
        if (value.isNaN() || value.isInfinite()) fail("CAPABILITY_RESULT_INVALID", "payload contains a non-finite number")
        value.toString()
    }
    is List<*> -> value.joinToString(prefix = "[", postfix = "]", separator = ",") { canonicalJson(it) }
    is Map<*, *> -> value.entries
        .map { entry ->
            val key = entry.key as? String ?: fail("CAPABILITY_RESULT_INVALID", "payload map keys must be strings")
            key to entry.value
        }
        .sortedBy { it.first }
        .joinToString(prefix = "{", postfix = "}", separator = ",") { (key, item) ->
            "${jsonQuote(key)}:${canonicalJson(item)}"
        }
    is ContainmentReport -> canonicalJson(
        linkedMapOf(
            "format" to value.format,
            "status" to value.status,
            "path" to value.path,
            "root" to value.root,
            "reason" to value.reason
        )
    )
    else -> fail("CAPABILITY_RESULT_INVALID", "unsupported value type in serialization: ${value::class.qualifiedName}")
}

private fun integrityDigest(payload: String): String {
    val bytes = MessageDigest.getInstance("SHA-256")
        .digest("$FORMAT|$VERSION|$payload".toByteArray(StandardCharsets.UTF_8))
    return bytes.joinToString("") { "%02x".format(it) }
}

/** Serialize report data using the SPR1 deterministic envelope. */
fun serializeReport(report: Any?): String {
    val payload = canonicalJson(report)
    if (payload.toByteArray(StandardCharsets.UTF_8).size > MAX_SERIALIZED) {
        fail("LIMIT_EXCEEDED", "report exceeds $MAX_SERIALIZED bytes")
    }
    return "{\"format\":\"$FORMAT\",\"version\":$VERSION,\"payload\":${jsonQuote(payload)},\"integrity\":\"${integrityDigest(payload)}\"}"
}

/** Contract format identifier. */
fun SAFE_PATH_RESOLVER_FORMAT(): String = FORMAT

/** Contract version. */
fun SAFE_PATH_RESOLVER_VERSION(): Int = VERSION

/** Contract limits. */
fun SAFE_PATH_RESOLVER_LIMITS(): Map<String, Int> = mapOf(
    "MAX_PATH" to MAX_PATH,
    "MAX_SEGMENTS" to MAX_SEGMENTS,
    "MAX_SYMLINK_DEPTH" to MAX_SYMLINK_DEPTH,
    "MAX_SERIALIZED" to MAX_SERIALIZED
)
