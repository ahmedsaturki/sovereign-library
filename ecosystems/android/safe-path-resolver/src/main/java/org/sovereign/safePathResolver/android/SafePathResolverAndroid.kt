package org.sovereign.safePathResolver.android

/**
 * SPR1 — Safe Path Resolver (Android-native).
 *
 * Native Android implementation of the Sovereign `safe-path-resolver` contract
 * (canonical Node implementation: cubes/safe-path-resolver-containment-boundary/src/index.js).
 * It satisfies the shared language-neutral conformance vectors exactly, reusing the
 * same canonical algorithm as the Kotlin/JVM port.
 *
 * Android specifics:
 * - This Cube is pure Kotlin and uses no Android-framework APIs, so it runs on the
 *   standard Android JVM (ART) with zero additional runtime dependencies.
 * - File I/O is NOT performed; only lexical path analysis is supported (matching the
 *   contract). On Android, real filesystem access would require the Storage Access
 *   Framework / scoped storage; this Cube stays lexical by contract and is therefore
 *   equally safe and deterministic on Android as on the desktop JVM.
 * - The default JVM toolchain target is preserved; AGP compiles this to an Android
 *   library (AAR) with `minSdk` set per the repository's conservative baseline.
 */

/** Thrown for any contract violation (invalid input, containment escape, etc.). */
class SafePathResolverError(val code: String, message: String) : Exception(message)

/**
 * Resolution options. All fields are platform-neutral; no Android-specific option is
 * required because the Cube is lexical only.
 */
data class SafePathResolverOptions(
    val separatorNormalization: Boolean = true,
    val normalizeDotSegments: Boolean = true,
    val caseMode: String = "sensitive",
    val preserveNamespace: Boolean = true,
    val maxSegments: Int = MAX_SEGMENTS,
    val symlinkPolicy: String = "lexical-only",
    val maxSymlinkDepth: Int = MAX_SYMLINK_DEPTH
)

/** Result of [isContained] / [resolveContained]. */
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

private fun fail(code: String, message: String): Nothing = throw SafePathResolverError(code, message)

private fun validatePathInput(value: String) {
    if (value !is String) fail("INVALID_INPUT", "path must be a string")
    if (value.isEmpty()) fail("INVALID_INPUT", "path must not be empty")
    if (value.length > MAX_PATH) fail("PATH_TOO_LONG", "path exceeds $MAX_PATH characters")
}

private fun validateOptions(options: SafePathResolverOptions) {
    if (options.caseMode !in setOf("sensitive", "insensitive")) fail("INVALID_OPTION", "caseMode must be sensitive or insensitive")
    if (options.symlinkPolicy !in setOf("lexical-only", "resolve", "none")) fail("INVALID_OPTION", "symlinkPolicy unsupported")
    if (options.maxSegments <= 0 || options.maxSegments > MAX_SEGMENTS) fail("INVALID_OPTION", "maxSegments out of range")
    if (options.maxSymlinkDepth < 0 || options.maxSymlinkDepth > MAX_SYMLINK_DEPTH) fail("INVALID_OPTION", "maxSymlinkDepth out of range")
}

private data class RootDescriptor(val kind: String, val identity: String, val prefix: String, val rest: List<String>)

private fun rootDescriptor(value: String): RootDescriptor {
    if (Regex("^//\\?/[A-Za-z]:(/|$)").containsMatchIn(value)) {
        val m = Regex("^//\\?/([A-Za-z]:)(/|$)").find(value)!!
        val drive = m.groupValues[1]
        return RootDescriptor("namespace-drive", drive.lowercase(), "//?/$drive", emptyList())
    }
    if (Regex("^[A-Za-z]:/").containsMatchIn(value)) {
        val drive = value.take(2)
        return RootDescriptor("drive", drive.lowercase(), "$drive/", value.substring(3).split("/").filter { it.isNotEmpty() })
    }
    if (value.startsWith("//")) return RootDescriptor("unc", "unc", "//", value.substring(2).split("/").filter { it.isNotEmpty() })
    if (value.startsWith("/")) return RootDescriptor("absolute", "/", "/", value.substring(1).split("/").filter { it.isNotEmpty() })
    if (Regex("^[A-Za-z]:[^/]").containsMatchIn(value)) fail("ROOT_MISMATCH", "drive-relative paths such as C:foo are rejected")
    return RootDescriptor("relative", "", "", value.split("/").filter { it.isNotEmpty() })
}

private data class NormalizedPath(val root: RootDescriptor, val absolute: Boolean, val segments: List<String>, val path: String)

private fun normalizeSeparators(value: String, options: SafePathResolverOptions): String =
    if (options.separatorNormalization) value.replace('\\', '/') else value

private fun normalizeDotSegments(segments: List<String>): List<String> {
    val out = mutableListOf<String>()
    for (segment in segments) {
        when {
            segment.isEmpty() || segment == "." -> Unit
            segment == ".." -> { if (out.isNotEmpty() && out.last() != "..") out.removeAt(out.size - 1) else out.add("..") }
            else -> out.add(segment)
        }
    }
    return out
}

private fun normalizeCase(segment: String, options: SafePathResolverOptions): String =
    if (options.caseMode == "insensitive") segment.lowercase() else segment

private fun formatDescriptor(root: RootDescriptor, segments: List<String>): String =
    when (root.kind) {
        "relative" -> segments.joinToString("/")
        "namespace-drive", "drive" -> root.prefix + segments.joinToString("/")
        "unc" -> "//" + segments.joinToString("/")
        "absolute" -> "/" + segments.joinToString("/")
        else -> "/" + segments.joinToString("/")
    }

private fun parseAndNormalize(value: String, options: SafePathResolverOptions): NormalizedPath {
    validatePathInput(value)
    validateOptions(options)
    val normalizedInput = normalizeSeparators(value, options)
    if (Regex("^[A-Za-z]:[^/]").containsMatchIn(normalizedInput)) fail("ROOT_MISMATCH", "drive-relative paths such as C:foo are rejected")
    val root = rootDescriptor(normalizedInput)
    val rawSegments = root.rest
    if (rawSegments.size > options.maxSegments) fail("SEGMENT_LIMIT", "path segment count exceeds limit")
    val segments = if (options.normalizeDotSegments) normalizeDotSegments(rawSegments) else rawSegments
    for (segment in segments) {
        if (segment.length > MAX_PATH) fail("SEGMENT_TOO_LONG", "segment exceeds $MAX_PATH characters")
    }
    val path = formatDescriptor(root, segments)
    if (path.length > MAX_PATH) fail("PATH_TOO_LONG", "normalized path exceeds $MAX_PATH characters")
    return NormalizedPath(root, root.kind != "relative", segments, path)
}

private fun sameRoot(a: String, b: String, caseMode: String): Boolean =
    if (caseMode == "insensitive") a.equals(b, ignoreCase = true) else a == b

/**
 * Normalize a path string.
 * - `separatorNormalization` rewrites backslashes to forward slashes.
 * - `normalizeDotSegments` resolves `.`/`..` lexically.
 * - `caseMode` governs segment *comparison* semantics; the returned path preserves
 *   the original case of segments (case is not folded into the output).
 */
fun normalizePath(input: String, options: SafePathResolverOptions = SafePathResolverOptions()): String {
    val parsed = parseAndNormalize(input, options)
    return parsed.path
}

private fun reportStatus(candidate: NormalizedPath, normalizedRoot: NormalizedPath, options: SafePathResolverOptions): String {
    val contained = candidate.root.kind == normalizedRoot.root.kind &&
        sameRoot(candidate.root.identity, normalizedRoot.root.identity, options.caseMode) &&
        candidate.segments.size >= normalizedRoot.segments.size &&
        candidate.segments.take(normalizedRoot.segments.size).map { normalizeCase(it, options) }
            .zip(normalizedRoot.segments.map { normalizeCase(it, options) }).all { it.first == it.second }
    return if (contained) "contained" else "outside"
}

private fun containmentReason(candidate: NormalizedPath, normalizedRoot: NormalizedPath, options: SafePathResolverOptions): String =
    if (candidate.root.kind != normalizedRoot.root.kind ||
        !sameRoot(candidate.root.identity, normalizedRoot.root.identity, options.caseMode)) "root-mismatch"
    else "segment-outside"

/**
 * Decide whether [candidate] is contained within [root].
 * Returns a [ContainmentReport] with status `contained` or `outside`.
 */
fun isContained(candidate: String, root: String, options: SafePathResolverOptions = SafePathResolverOptions()): ContainmentReport {
    val normalizedRoot = parseAndNormalize(root, options)
    val candidatePath = parseAndNormalize(candidate, options)
    val contained = reportStatus(candidatePath, normalizedRoot, options)
    val reason = if (contained == "contained") "segment-contained" else containmentReason(candidatePath, normalizedRoot, options)
    return ContainmentReport(FORMAT, contained, candidatePath.path, normalizedRoot.path, reason)
}

/**
 * Resolve [candidate] against [root].
 * - Throws [SafePathResolverError] if resolution would escape [root] (traversal or
 *   absolute escape).
 * - Returns the resolved, normalized path (never escaping the root) on success.
 */
fun resolveContained(candidate: String, root: String, options: SafePathResolverOptions = SafePathResolverOptions()): String {
    val report = isContained(candidate, root, options)
    if (report.status != "contained") fail("ROOT_MISMATCH", "candidate ${report.path} is not contained within root ${report.root} (${report.reason})")
    return report.path
}

/** Contract format identifier. */
fun SAFE_PATH_RESOLVER_FORMAT(): String = FORMAT

/** Contract version. */
fun SAFE_PATH_RESOLVER_VERSION(): Int = VERSION

/** Contract limits (mirrors the canonical Node export). */
fun SAFE_PATH_RESOLVER_LIMITS(): Map<String, Int> = mapOf(
    "MAX_PATH" to MAX_PATH,
    "MAX_SEGMENTS" to MAX_SEGMENTS,
    "MAX_SYMLINK_DEPTH" to MAX_SYMLINK_DEPTH,
    "MAX_SERIALIZED" to MAX_SERIALIZED
)

// ---------------------------------------------------------------------------
// Serializable envelope (canonical JSON, contract-shaped)
// ---------------------------------------------------------------------------

private fun canonicalJson(value: Any?): String = when (value) {
    null -> "null"
    is String -> JSONObjectQuote(value)
    is Number -> value.toString()
    is Boolean -> value.toString()
    is Map<*, *> -> "{" + value.entries.sortedBy { it.key.toString() }.joinToString(",") { "${JSONObjectQuote(it.key.toString())}:${canonicalJson(it.value)}" } + "}"
    is List<*> -> "[" + value.joinToString(",") { canonicalJson(it) } + "]"
    is Enum<*> -> JSONObjectQuote(value.name)
    else -> {
        val props = value::class.java.methods
            .filter { it.parameterCount == 0 && it.name.matches(Regex("^get[A-Z].*|^is[A-Z].*")) }
            .filter { it.name !in setOf("getClass", "hashCode", "toString", "equals") }
            .sortedBy { it.name }
        "{" + props.joinToString(",") { "${JSONObjectQuote(it.name.removePrefix("get").removePrefix("is").replaceFirstChar { c -> c.lowercase() })},${canonicalJson(it.invoke(value))}" } + "}"
    }
}

private fun JSONObjectQuote(value: String): String {
    val sb = StringBuilder("\"")
    for (c in value) {
        when (c) {
            '"' -> sb.append("\\\"")
            '\\' -> sb.append("\\\\")
            '\n' -> sb.append("\\n")
            '\r' -> sb.append("\\r")
            '\t' -> sb.append("\\t")
            else -> sb.append(c)
        }
    }
    sb.append('"')
    return sb.toString()
}

/** Serialize a [ContainmentReport] into the canonical `{format,version,payload,integrity}` envelope. */
fun serializeReport(report: ContainmentReport): String {
    val payload = canonicalJson(report)
    val digest = java.security.MessageDigest.getInstance("SHA-256").digest(payload.toByteArray(Charsets.UTF_8))
    val integrity = digest.joinToString("") { "%02x".format(it) }
    return "{\"format\":\"SPR1\",\"version\":$VERSION,\"payload\":$payload,\"integrity\":\"$integrity\"}"
}
