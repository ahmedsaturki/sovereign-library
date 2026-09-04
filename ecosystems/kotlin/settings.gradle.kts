rootProject.name = "sovereign-kotlin"

pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

include("safe-path-resolver")
include("runtime-capability-inspector")
include("conformance")
