description = "RCI1 Runtime Capability Inspector — native Kotlin/JVM implementation of the sovereign runtime-capability-inspector contract"

dependencies {
    implementation(kotlin("stdlib"))
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.0")
    testImplementation(project(":conformance"))
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:1.11.0")
}

tasks.withType<Jar> {
    archiveClassifier.set("")
    manifest {
        attributes(
            "Implementation-Title" to "Runtime Capability Inspector",
            "Implementation-Version" to project.version,
            "Main-Class" to "org.sovereign.runtimeCapabilityInspector.Main"
        )
    }
}
