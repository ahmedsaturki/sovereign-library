package org.sovereign.runtimeCapabilityInspector

/**
 * Conformance facade: exposes the canonical RCI1 export surface (instance methods +
 * shared constants) through a single dispatch target so the language-neutral conformance
 * runner can resolve every `call` name uniformly. This is the exact export set the
 * canonical vectors exercise: inspectRuntime, evaluateRuntimeRequirements,
 * serializeRuntimeReport, parseRuntimeReport, RUNTIME_CAPABILITY_FORMAT,
 * RUNTIME_OS_FAMILIES, RUNTIME_ARCHITECTURES.
 *
 * Constants are exposed as 0-argument functions (not fields) so the runner's method-name
 * dispatch resolves them the same way it resolves the instance methods.
 */
object Rci1Conformance {

    private val inspector = RuntimeCapabilityInspector()

    fun inspectRuntime(options: Map<String, Any> = emptyMap()): Snapshot = inspector.inspectRuntime(options)
    fun evaluateRuntimeRequirements(snapshot: Snapshot, requirements: Map<String, Any>): Verdict =
        inspector.evaluateRuntimeRequirements(snapshot, requirements)
    fun serializeRuntimeReport(report: Any): String = inspector.serializeRuntimeReport(report)
    fun parseRuntimeReport(serialized: String): Map<String, Any?> = inspector.parseRuntimeReport(serialized)

    fun RUNTIME_CAPABILITY_FORMAT(): String = RCI1.RUNTIME_CAPABILITY_FORMAT
    fun RUNTIME_OS_FAMILIES(): List<String> = RCI1.RUNTIME_OS_FAMILIES
    fun RUNTIME_ARCHITECTURES(): List<String> = RCI1.RUNTIME_ARCHITECTURES
}
