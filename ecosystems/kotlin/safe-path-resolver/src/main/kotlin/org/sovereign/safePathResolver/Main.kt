package org.sovereign.safePathResolver

fun main() {
    println("Safe Path Resolver SPR1 - Kotlin/JVM implementation")
    println("Format: ${SafePathResolver.SAFE_PATH_RESOLVER_FORMAT()}")

    val testPath = "/a/b/../c"
    val normalized = SafePathResolver.normalizePath(testPath)
    println("Normalize '$testPath' -> '$normalized'")

    val contained = SafePathResolver.isContained("/a/b/c", "/a").status == "contained"
    println("Is '/a/b/c' contained in '/a'? $contained")

    val resolved = SafePathResolver.resolveContained("/a", "b/c")
    println("Resolve contained '/a' + 'b/c' -> '$resolved'")

    println("SPR1 implementation complete.")
}
