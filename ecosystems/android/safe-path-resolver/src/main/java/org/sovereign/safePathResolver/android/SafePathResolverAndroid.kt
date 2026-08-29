package org.sovereign.safePathResolver.android

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
    if (Regex("^//\\\\?/[A-Za-z]:(/|$)").containsMatchIn(value)) {
        val m = Regex("^//\\\\?/([A-Za-z]:)(/|$)").find(value)!!
        val drive = m.groupValues[1]
        return RootDescriptor("namespace-drive", drive.lowercase(), "//?/$drive", emptyList())
    }
    if (Regex("^[A-Za-z]:/").containsMatchIn(value)) {
        val drive = value.take(2)
        return RootDescriptor("drive", drive.lowercase(), "$drive/", value.substring(3).split("/").filter { it.isNotEmpty() })
    }
    if (value.startsWith("//")) return RootDescriptor("unc", "unc", "//", value.substring(2).split("/").filter { it.isNotEmpty() })
    if (value.startsWith("/")) return RootDescriptor("absolute", "/", "/", value.substring(1).split("/").filter { it.isNotEmpty() }
    if (Regex("^[A-Za-z]:[^/]").containsMatchIn(value)) fail("ROOT_MISMATCH", "drive-relative paths such as C:foo are rejected")
    return RootDescriptor("relative", "", "", value.split("/").filter { it.isNotEmpty() }
}

private data class NormalizedPath(val root: RootDescriptor, val absolute: Boolean, val segments: List<String>, val path: String)

private fun normalizeSeparators(value: String, options: SafePathResolverOptions): String =
    if (options.separatorNormalization) value.replace('\\\\', '/') else value

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

private fun formatDescriptor(root: RootDescriptor, segments: List<String>): String {
    when (root.kind) {
        "relative" -> segments.joinToString("/")
        "namespace-drive", "drive" -> root.prefix + segments.joinToString("/")
        "unc" -> "//" + segments.joinToString("/")
        "absolute" -> "/" + segments.joinToString("/")
        else -> "/" + segments.joinToString("/")
    }
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

/** Normalize a path string with default options. */
fun normalizePath(input: String): String = normalizePath(input, SafePathResolverOptions())

/** Normalize a path string. */
fun normalizePath(input: String, options: SafePathResolverOptions): String {
    val parsed = parseAndNormalize(input, options)
    return parsed.path
}

/** Decide whether [candidate] is contained within [root] with default options. */
fun isContained(candidate: String, root: String): ContainmentReport = isContained(candidate, root, SafePathResolverOptions())

/** Decide whether [candidate] is contained within [root]. */
fun isContained(candidate: String, root: String, options: SafePathResolverOptions): ContainmentReport {
    val normalizedRoot = parseAndNormalize(root, options)
    val candidatePath = parseAndNormalize(candidate, options)
    val contained = reportStatus(candidatePath, normalizedRoot, options)
    val reason = if (contained == "contained") "segment-contained" else containmentReason(candidatePath, normalizedRoot, options)
    return ContainmentReport(FORMAT, contained, candidatePath.path, normalizedRoot.path, reason)
}

/** Resolve [candidate] against [root] with default options. */
fun resolveContained(candidate: String, root: String): String = resolveContained(candidate, root, SafePathResolverOptions())

/** Resolve [candidate] against [root]. */
fun resolveContained(candidate: String, root: String, options: SafePathResolverOptions): String {
    val normalizedRoot = parseAndNormalize(root, options)
    val candidatePath = parseAndNormalize(candidate, options)
    val resolvedPath: String = when (normalizedRoot.root.kind) {
        "absolute" -> "/${normalizedRoot.root.rest.joinToString("/")}/${candidatePath.absolute ? candidatePath.path : candidatePath.segments.joinToString("/")}"
        "relative" -> candidatePath.path
        "drive" -> "${normalizedRoot.root.prefix}${candidatePath.absolute ? candidatePath.path : candidatePath.segments.joinToString("/")}"
        "unc" -> "${normalizedRoot.root.prefix}/${candidatePath.absolute ? candidatePath.path : candidatePath.segments.joinToString("/")}"
        "namespace-drive" -> "${normalizedRoot.root.prefix}/${candidatePath.absolute ? candidatePath.path : candidatePath.segments.joinToString("/")}"
        "namespace-unc" -> "${normalizedRoot.root.prefix}/${candidatePath.absolute ? candidatePath.path : candidatePath.segments.joinToString("/")}"
        else -> "/${candidatePath.path}"
    }
    val report = isContained(resolvedPath, root, options)
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