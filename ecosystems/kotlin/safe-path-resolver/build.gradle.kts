description = "SPR1 Safe Path Resolver — native Kotlin/JVM implementation of the sovereign safe-path-resolver contract"

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
            "Implementation-Title" to "Safe Path Resolver",
            "Implementation-Version" to project.version,
            "Main-Class" to "org.sovereign.safePathResolver.Main"
        )
    }
}
