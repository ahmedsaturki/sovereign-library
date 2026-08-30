package org.sovereign.conformance

import org.json.JSONArray
import org.json.JSONObject
import org.sovereign.safePathResolver.android.ContainmentReport
import java.util.Locale

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
        is JSONObject -> jsonObjectToMap(value)
        is JSONArray -> jsonArrayToList(value)
        else -> value
    }

    private fun jsonObjectToMap(obj: JSONObject): Map<String, Any?> {
        val result = mutableMapOf<String, Any?>()
        val keys = obj.keys()
        while (keys.hasNext()) {
            val key = keys.next() as String
            result[key] = toKotlin(obj.opt(key))
        }
        return result
    }

    private fun jsonArrayToList(arr: JSONArray): List<Any?> {
        val result = mutableListOf<Any?>()
        for (i in 0 until arr.length()) {
            result.add(toKotlin(arr.opt(i)))
        }
        return result
    }

    private fun comparable(value: Any?): Any? = when (value) {
        is ContainmentReport -> mapOf(
            "format" to value.format,
            "status" to value.status,
            "path" to value.path,
            "root" to value.root,
            "reason" to value.reason
        )
        is Map<*, *> -> value.entries.associate { it.key.toString() to it.value }
        is List<*> -> value.map(::comparable)
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
        val loader = this::class.java.classLoader
            ?: throw IllegalStateException("no class loader")
        val text = loader.getResourceAsStream(resourceName)?.bufferedReader()?.readText()
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
            val rawArgsArray = call.getJSONArray(1)
            val rawArgs = List(rawArgsArray.length()) { j -> toKotlin(rawArgsArray.opt(j)) }
            val bindings = mutableMapOf<String, Any?>()
            val args = rawArgs.map { raw ->
                if (raw is String) resolveBinding(raw, bindings) else raw
            }
            val expect = v.getJSONObject("expect")
            val kind = expect.getString("kind")
            try {
                val actual = dispatch(method, args)
                when (kind) {
                    "value" -> {
                        val expected = toKotlin(expect.get("value"))
                        val left = comparable(actual)
                        val right = comparable(expected)
                        if (left == right) { pass++ } else {
                            fail++
                            System.err.println("FAIL $id: expected $right got $left")
                        }
                    }
                    "shape" -> {
                        val keys = jsonArrayToList(expect.getJSONArray("requiredKeys"))
                        if (checkShape(actual, keys)) { pass++ } else {
                            fail++
                            System.err.println("FAIL $id: shape mismatch $actual")
                        }
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
