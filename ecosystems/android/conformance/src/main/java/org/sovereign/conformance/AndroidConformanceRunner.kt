package org.sovereign.conformance

import org.json.JSONArray
import org.json.JSONObject
import org.sovereign.safePathResolver.android.ContainmentReport

/**
 * Language-neutral conformance runner for the Android SPR1 build.
 * Fresh bindings per vector, `$binding` resolution, method dispatch by name + arity,
 * value/shape comparisons, and typed exception assertions.
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

    private fun jsonArrayToList(arr: JSONArray): List<Any?> =
        List(arr.length()) { i -> toKotlin(arr.opt(i)) }

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
        for (method in apiClass.methods.filter { it.name == methodName }) {
            if (method.parameterTypes.size != args.size) continue
            val converted = args.mapIndexed { i, value ->
                when {
                    value == null -> null
                    method.parameterTypes[i].isAssignableFrom(value.javaClass) -> value
                    method.parameterTypes[i] == Map::class.java && value is Map<*, *> -> value
                    else -> value
                }
            }
            try {
                return method.invoke(null, *converted.toTypedArray())
            } catch (e: java.lang.reflect.InvocationTargetException) {
                throw e.cause ?: e
            }
        }
        throw IllegalStateException("No matching method $methodName with arity ${args.size}")
    }

    private fun checkShape(actual: Any?, requiredKeys: List<*>): Boolean {
        if (actual !is Map<*, *>) return false
        return requiredKeys.all { it in actual }
    }

    private fun expectedErrorName(expect: JSONObject): String =
        expect.optString("errorName", "").takeIf { it.isNotEmpty() } ?: "Throwable"

    private fun actualErrorName(error: Throwable): String =
        error::class.java.simpleName

    fun runSuite(resourceName: String): Pair<Int, Int> {
        val loader = this::class.java.classLoader ?: throw IllegalStateException("no class loader")
        val text = loader.getResourceAsStream(resourceName)?.bufferedReader()?.readText()
            ?: throw IllegalStateException("conformance vector not found: $resourceName")
        val root = JSONObject(text)
        val vectors = root.getJSONArray("vectors")
        var pass = 0
        var fail = 0

        for (i in 0 until vectors.length()) {
            val vector = vectors.getJSONObject(i)
            val id = vector.optString("id", "#$i")
            val call = vector.getJSONArray("call")
            val method = call.getString(0)
            val rawArgs = jsonArrayToList(call.getJSONArray(1))
            val bindings = mutableMapOf<String, Any?>()
            val args = rawArgs.map { value ->
                if (value is String) resolveBinding(value, bindings) else value
            }
            val expect = vector.getJSONObject("expect")
            val kind = expect.getString("kind")

            try {
                val actual = dispatch(method, args)
                when (kind) {
                    "value" -> {
                        val expected = toKotlin(expect.get("value"))
                        if (comparable(actual) == comparable(expected)) pass++ else {
                            fail++
                            System.err.println("FAIL $id: expected ${comparable(expected)} got ${comparable(actual)}")
                        }
                    }
                    "shape" -> {
                        val keys = jsonArrayToList(expect.getJSONArray("requiredKeys"))
                        if (checkShape(actual, keys)) pass++ else {
                            fail++
                            System.err.println("FAIL $id: shape mismatch $actual")
                        }
                    }
                    "throws" -> {
                        fail++
                        System.err.println("FAIL $id: expected ${expectedErrorName(expect)} but method returned $actual")
                    }
                    else -> {
                        fail++
                        System.err.println("FAIL $id: unknown expect kind $kind")
                    }
                }
            } catch (e: Throwable) {
                if (kind == "throws" && actualErrorName(e) == expectedErrorName(expect)) {
                    pass++
                } else if (kind == "throws") {
                    fail++
                    System.err.println("FAIL $id: expected ${expectedErrorName(expect)} got ${actualErrorName(e)}: ${e.message}")
                } else {
                    fail++
                    System.err.println("FAIL $id: unexpected throw ${actualErrorName(e)}: ${e.message}")
                }
            }
        }

        return pass to fail
    }
}
