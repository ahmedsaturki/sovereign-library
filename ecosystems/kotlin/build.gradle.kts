plugins {
    id("org.jetbrains.kotlin.jvm") version "2.0.0" apply false
}

allprojects {
    group = "org.sovereign"
    version = "0.1.0"

    repositories {
        mavenCentral()
    }
}

subprojects {
    apply(plugin = "org.jetbrains.kotlin.jvm")

    repositories {
        mavenCentral()
    }

    tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        kotlinOptions {
            jvmTarget = "17"
            freeCompilerArgs = listOf(
                "-opt-in=kotlin.RequiresOptIn",
                "-Xjsr305=strict",
                "-Xno-param-assertions"
            )
        }
    }

    tasks.withType<Test> {
        useJUnitPlatform()
        systemProperty("conformance.debug", System.getProperty("conformance.debug") ?: "")
        testLogging {
            events("passed", "skipped", "failed")
            showStandardStreams = true
        }
    }

    tasks.withType<Jar> {
        isPreserveFileTimestamps = false
        isReproducibleFileOrder = true
        manifest {
            attributes(
                "Implementation-Title" to project.name,
                "Implementation-Version" to project.version,
                "Implementation-Vendor" to "Sovereign Library",
                "Automatic-Module-Name" to "org.sovereign.${project.name.replace("-", ".")}"
            )
        }
    }
}
