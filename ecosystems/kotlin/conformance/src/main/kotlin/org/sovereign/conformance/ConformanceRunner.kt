package org.sovereign.conformance

import java.io.File

/**
 * Language-neutral conformance runner for Sovereign Library Kotlin/JVM native ports.
 *
 * Mirrors python/scripts/run_conformance.py semantics exactly:
 *  - reads the SAME canonical vector files (contracts/conformance/vectors.<cube>.json);
 *  - resolves `$binding` references against values produced by prior `setup`/`serializeFirst` steps;
 *  - dispatches each `call` as `<exportName>(...args)` on the supplied [target];
 *  - asserts `expect` (kind: value / shape / throws), including `pick`, `expectFailuresContains`.
 *
 * A native port MUST satisfy the canonical contract exactly. No fabrication: the vectors are
 * the authoritative contract and this runner executes them against the real implementation.
 */

private data class VectorResult(val ok: Boolean, val message: String)

fun locateVectorFile(name: String): File {
    val repoRootCandidates = mutableListOf<File>()
    var dir: File? = File(System.getProperty("user.dir"))
    while (dir != null) {
        repoRootCandidates.add(File(dir, "contracts/conformance/$name"))
        dir = dir.parentFile
    }
    return repoRootCandidates.firstOrNull { it.exists() }
        ?: error("Conformance vector file not found: $name (searched up from ${System.getProperty("user.dir")})")
}

fun runConformanceVectors(vectorFile: String, target: Any): Boolean {
    val file = locateVectorFile(vectorFile)
    val text = file.readText(Charsets.UTF_8)
    val suite = JsonObject.parse(text) as? Map<*, *> ?: error("vector file is not a JSON object")
    val contract = (suite["contract"] as? String) ?: error("vector file missing 'contract'")
    val format = (suite["format"] as? String) ?: ""
    val vectors = (suite["vectors"] as? List<*>) ?: error("vector file missing 'vectors'")

    var passed = 0
    var failed = 0
    val failures = mutableListOf<String>()

    for (raw in vectors) {
        val vector = raw as Map<String, Any?>
        val id = (vector["id"] as? String) ?: "<unknown>"
        try {
            val result = runVector(target, vector)
            if (result.ok) {
                passed++
                println("  PASS  $contract :: $id")
            } else {
                failed++
                failures.add(id)
                println("  FAIL  $contract :: $id -> ${result.message}")
            }
        } catch (e: Throwable) {
            failed++
            failures.add(id)
            println("  ERROR $contract :: $id -> ${e::class.simpleName}: ${e.message}")
        }
    }

    println("\n[conformance] $contract ($format): $passed passed, $failed failed")
    if (failed > 0) println("[conformance] FAILED vectors: ${failures.joinToString(", ")}")
    return failed == 0
}

private fun runVector(target: Any, vector: Map<String, Any?>): VectorResult {
    val bindings = mutableMapOf<String, Any?>()
    (vector["setup"] as? Map<*, *>)?.let { setup ->
        bindings["snapshot"] = callExport(target, setup["call"] as List<*>, bindings)
    }
    (vector["serializeFirst"] as? Map<*, *>)?.let { sf ->
        bindings["serialized"] = callExport(target, sf["call"] as List<*>, bindings)
    }
    val expect = vector["expect"] as Map<String, Any?>
    val subject = vector["call"] as List<*>
    return try {
        val actual = callExport(target, subject, bindings)
        when (expect["kind"]) {
            "throws" -> VectorResult(false, "expected throw ${expect["errorName"]} but returned value")
            "value" -> {
                val ok = if (expect.containsKey("pick")) {
                    deepEqualPick(toComparableMap(actual), expect["pick"] as Map<String, Any?>)
                } else {
                    deepEqual(toComparableMap(actual), expect["value"])
                }
                if (!ok) return VectorResult(false, "value mismatch\n  expected: ${expect["pick"] ?: expect["value"]}\n  actual:   $actual")
                (expect["expectFailuresContains"] as? Map<*, *>)?.let { wanted ->
                    val failures = ((toComparableMap(actual) as? Map<*, *>)?.get("failures") as? List<*>) ?: emptyList<Any?>()
                    val found = failures.any { f ->
                        f is Map<*, *> && shapeHasKeys(f, wanted.keys) && deepEqualPick(f, wanted)
                    }
                    if (!found) return VectorResult(false, "failures missing $wanted in $failures")
                }
                VectorResult(true, "")
            }
            "shape" -> {
                val required = expect["requiredKeys"] as List<*>
                val actualMap = toComparableMap(actual)
                if (actualMap !is Map<*, *>) return VectorResult(false, "value is not an object")
                val missing = required.filter { !actualMap.containsKey(it) }
                if (missing.isNotEmpty()) VectorResult(false, "missing keys: ${missing.joinToString(", ")}") else VectorResult(true, "")
            }
            else -> VectorResult(false, "unknown expectation kind: ${expect["kind"]}")
        }
    } catch (e: Throwable) {
        if (expect["kind"] == "throws") {
            val want = expect["errorName"] as? String
            if (want != null && e::class.simpleName != want) VectorResult(false, "threw ${e::class.simpleName}, expected $want")
            else VectorResult(true, "")
        } else VectorResult(false, "unexpected throw: ${e::class.simpleName}: ${e.message}")
    }
}

private fun callExport(target: Any, callSpec: List<*>, bindings: MutableMap<String, Any?>): Any? {
    val name = callSpec[0] as String
    val rawArgs = (if (callSpec.size > 1) callSpec[1] else null) as? List<*>
    val args = rawArgs?.map { resolveBindings(it, bindings) }?.toTypedArray() ?: emptyArray()
    val fn = name.split(".").fold<Any?, Any?>(target) { cur, part ->
        when (cur) {
            is Map<*, *> -> cur[part]
            null -> null
            else -> {
                val m = cur::class.java.methods.firstOrNull { it.name == part && it.parameterCount == args.size }
                    ?: cur::class.java.methods.firstOrNull { it.name == part && it.parameterCount <= args.size }
                if (m != null) ConformanceMethod(cur, m)
                else cur::class.java.fields.firstOrNull { it.name == part }?.get(cur)
            }
        }
    }
    return when (fn) {
        is ConformanceMethod -> try {
            fn.method.invoke(fn.receiver, *args)
        } catch (e: java.lang.reflect.InvocationTargetException) {
            var cause = e.cause
            while (cause is java.lang.reflect.InvocationTargetException) cause = cause.cause
            if (cause != null) throw cause else throw e
        }
        else -> fn
    }
}

private data class ConformanceMethod(val receiver: Any, val method: java.lang.reflect.Method)

private fun resolveBindings(value: Any?, bindings: Map<String, Any?>): Any? {
    return when {
        value is String && value.startsWith("$") -> {
            var cur: Any? = bindings
            for (part in value.substring(1).split(".")) {
                cur = when (cur) {
                    is Map<*, *> -> cur[part]
                    is Any -> {
                        // navigate into a data class / plain object public property.
                        // Match the property name directly, or the JavaBean getter (getX / isX).
                        val cap = part.replaceFirstChar { it.uppercase() }
                        val prop = cur::class.java.methods.firstOrNull { m ->
                            m.parameterCount == 0 && (m.name == part || m.name == "get$cap" || m.name == "is$cap")
                        }
                        if (prop != null) {
                            prop.invoke(cur)
                        } else {
                            val f = cur::class.java.fields.firstOrNull { it.name == part }
                            f?.also { it.isAccessible = true }?.get(cur)
                        }
                    }
                    else -> null
                }
            }
            cur
        }
        value is List<*> -> value.map { resolveBindings(it, bindings) }
        value is Map<*, *> -> value.mapValues { resolveBindings(it.value, bindings) }
        else -> value
    }
}

/** Project a data class (or any object) into a comparable Map of its readable properties. */
private fun toComparableMap(value: Any?): Any? {
    return when (value) {
        null -> null
        is Map<*, *> -> value.mapValues { toComparableMap(it.value) }
        is List<*> -> value.map { toComparableMap(it) }
        is Enum<*> -> value.name
        is Number -> value
        is String, is Boolean -> value
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
                    key to toComparableMap(method.invoke(value))
                }
            if (props.isEmpty()) value.toString() else props
        }
    }
}

private fun deepEqual(a: Any?, b: Any?): Boolean {
    if (a === b) return true
    if (a is Map<*, *> && b is Map<*, *>) {
        if (a.size != b.size) return false
        return a.all { (k, v) -> b.containsKey(k) && deepEqual(v, b[k]) }
    }
    if (a is List<*> && b is List<*>) {
        if (a.size != b.size) return false
        return a.indices.all { deepEqual(a[it], b[it]) }
    }
    if (a is Number && b is Number) {
        // integers compared by value; care only about equality of numeric magnitude
        return a.toLong() == b.toLong() || a.toDouble() == b.toDouble()
    }
    return a == b
}

private fun deepEqualPick(actual: Any?, pick: Map<*, *>): Boolean {
    if (actual !is Map<*, *>) return false
    return pick.all { (k, v) -> deepEqual(actual[k], v) }
}

private fun shapeHasKeys(value: Map<*, *>, keys: Set<*>): Boolean =
    keys.all { value.containsKey(it) }

// ---------------------------------------------------------------------------
// Minimal JSON support (stdlib-only) — deterministic, no external dependency.
// ---------------------------------------------------------------------------

private object JsonObject {
    fun parse(s: String): Any? = parseValue(s.trim(), 0).first

    private fun parseValue(s: String, start: Int): Pair<Any?, Int> {
        var i = start
        while (i < s.length && s[i].isWhitespace()) i++
        return when (s[i]) {
            '{' -> {
                val map = linkedMapOf<String, Any?>()
                i++
                while (i < s.length) {
                    while (i < s.length && (s[i] == ',' || s[i].isWhitespace())) i++
                    if (s[i] == '}') { i++; break }
                    val (k, ni) = parseString(s, i)
                    i = ni
                    while (i < s.length && s[i].isWhitespace()) i++
                    i++ // ':'
                    val (v, nj) = parseValue(s, i)
                    map[k] = v
                    i = nj
                }
                map to i
            }
            '[' -> {
                val list = mutableListOf<Any?>()
                i++
                while (i < s.length) {
                    while (i < s.length && (s[i] == ',' || s[i].isWhitespace())) i++
                    if (s[i] == ']') { i++; break }
                    val (v, nj) = parseValue(s, i)
                    list.add(v)
                    i = nj
                }
                list to i
            }
            '"' -> {
                val (str, ni) = parseString(s, i)
                str to ni
            }
            't', 'f' -> if (s.startsWith("true", i)) true to i + 4 else false to i + 5
            'n' -> null to i + 4
            else -> {
                var j = i
                while (j < s.length && (s[j].isDigit() || s[j] in "+-.eE".toSet())) j++
                val num = s.substring(i, j).toIntOrNull() ?: s.substring(i, j).toLongOrNull()
                    ?: s.substring(i, j).toDoubleOrNull()
                num to j
            }
        }
    }

    private fun parseString(s: String, start: Int): Pair<String, Int> {
        var i = start + 1
        val sb = StringBuilder()
        while (i < s.length) {
            when (val c = s[i]) {
                '\\' -> {
                    i++
                    sb.append(when (s[i]) {
                        '"' -> '"'; '\\' -> '\\'; '/' -> '/'; 'b' -> '\b'; 'f' -> '\u000c'
                        'n' -> '\n'; 'r' -> '\r'; 't' -> '\t'
                        'u' -> s.substring(i + 1, i + 5).toInt(16).toChar().also { i += 4 }
                        else -> c
                    })
                    i++
                }
                '"' -> return sb.toString() to i + 1
                else -> { sb.append(c); i++ }
            }
        }
        error("unterminated string")
    }
}
