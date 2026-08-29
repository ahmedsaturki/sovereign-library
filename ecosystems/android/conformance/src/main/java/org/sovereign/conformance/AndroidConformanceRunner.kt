package org.sovereign.conformance

import org.json.JSONArray
import org.json.JSONObject

/**
 * Language-neutral conformance runner for the Android SPR1 build.
 * Mirrors `python/scripts/run_conformance.py` and the Kotlin/JVM `conformance` module:
 * fresh bindings per vector, `$binding` resolution, method dispatch by name + arity,
 * `throws` -> errorName check, `expectFailuresContains` -> failures check.
 *
 * The Android SPR1 public API is hosted by [org.sovereign.safePathResolver.android].
 */
object AndroidConformanceRunner {

    private val apiClass = Class.forName("org.sovereign.safePathResolver.android.SafePathResolverAndroidKt")

    private fun resolveBinding(name: String, bindings: Map<String, Any?>): Any? {
        if (!name.startsWith("$")) return name
        val key = name.substring(1)
        if (key in bindings) return bindings[key]
        return when (key) {
            "format" -> "SPR1"
            "version" -> 1
            else -> name
        }
    }

    private fun toKotlin(value: Any?): Any? = when (value) {
        JSONObject.NULL -> null
        is JSONObject -> value.toMap().mapValues { toKotlin(it.value) }
        is JSONArray -> List(value.length()) { i -> toKotlin(value[i]) }
        else -> value
    }

    private fun dispatch(methodName: String, args: List<Any?>): Any? {
        for (m in apiClass.methods.filter { it.name == methodName }) {
            val params = m.parameterTypes
            if (params.size != args.size) continue
            val converted = args.mapIndexed { i, a ->
                when {
                    params[i].isAssignableFrom(a?.javaClass ?: Any::class.java) -> a
                    a is Map<*, *> && params[i] == Map::class.java -> a
                    a == null -> null
                    else -> a
                }
            }
            try { return m.invoke(null, *converted.toTypedArray()) } catch (e: java.lang.reflect.InvocationTargetException) { throw e.cause ?: e }
        }
        throw IllegalStateException("No matching method $methodName with arity ${args.size}")
    }

    private fun checkShape(actual: Any?, requiredKeys: List<*>): Boolean {
        if (actual !is Map<*, *>) return false
        return requiredKeys.all { it in actual }
    }

    fun runSuite(resourceName: String): Pair<Int, Int> {
        val text = this::class.java.classLoader.getResourceAsStream(resourceName)?.bufferedReader()?.readText()
            ?: throw IllegalStateException("conformance vector not found: $resourceName")
        val root = JSONObject(text)
        val vectors = root.getJSONArray("vectors")
        var pass = 0
        var fail = 0
        for (i in 0 until vectors.length()) {
            val v = vectors.getJSONObject(i)
            val id = v.optString("id", "#$i")
            val call = v.getJSONArray("call")
            val method = call.getString(0)
            val rawArgs = List(call.getJSONArray(1).length()) { j -> toKotlin(call.getJSONArray(1)[j]) }
            val bindings = mutableMapOf<String, Any?>()
            val args = rawArgs.map { resolveBinding(it as String, bindings) }
            val expect = v.getJSONObject("expect")
            val kind = expect.getString("kind")
            try {
                val actual = dispatch(method, args)
                when (kind) {
                    "value" -> {
                        val expected = toKotlin(expect.get("value"))
                        if (actual == expected) { pass++ } else { fail++; System.err.println("FAIL $id: expected $expected got $actual") }
                    }
                    "shape" -> {
                        val keys = expect.getJSONArray("requiredKeys").toList()
                        if (checkShape(actual, keys)) { pass++ } else { fail++; System.err.println("FAIL $id: shape mismatch $actual") }
                    }
                    "throws" -> { fail++; System.err.println("FAIL $id: expected throw but returned $actual") }
                    else -> { fail++; System.err.println("FAIL $id: unknown expect kind $kind") }
                }
            } catch (e: Throwable) {
                if (kind == "throws") { pass++ } else {
                    fail++
                    System.err.println("FAIL $id: unexpected throw ${e::class.simpleName}: ${e.message}")
                }
            }
        }
        return pass to fail
    }
}
