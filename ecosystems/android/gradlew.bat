@rem
@rem Copyright 2015 the original author or authors.
@rem
@rem Licensed under the Apache License, Version 2.0 (the "License");
@rem you may not use this file except in compliance with the License.
@rem You may obtain a copy of the License at
@rem
@rem      https://www.apache.org/licenses/LICENSE-2.0
@rem
@rem Unless required by applicable law or agreed to in writing, software
@rem distributed under the License is distributed on an "AS IS" BASIS,
@rem WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
@rem See the License for the specific language governing permissions and
@rem limitations under the License.
@rem
@rem SPDX-License-Identifier: Apache-2.0
@rem

@if "%DEBUG%"=="" @echo off
@rem ##########################################################################
@rem
@rem  Gradle startup script for Windows
@rem
@rem ##########################################################################

if "%OS%"=="Windows_NT" setlocal

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%

for %%i in ("%APP_HOME%") do set APP_HOME=%%~fi

@rem Sovereign Library bootstrap: keep the wrapper JAR out of Git while
@rem deterministically bootstrapping the official Gradle 8.9 wrapper JAR.
set WRAPPER_JAR=%APP_HOME%gradle\wrapper\gradle-wrapper.jar
if exist "%WRAPPER_JAR%" goto wrapperJarPresent

if not exist "%APP_HOME%gradle\wrapper" mkdir "%APP_HOME%gradle\wrapper" >NUL 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $url='https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradle/wrapper/gradle-wrapper.jar'; $out='%WRAPPER_JAR%'; $tmp=$out+'.tmp'; Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $tmp; $expected='498495120a03b9a6ab5d155f5de3c8f0d986a449153702fb80fc80e134484f17'; $actual=(Get-FileHash -Algorithm SHA256 -Path $tmp).Hash.ToLowerInvariant(); if ($actual -ne $expected) { Remove-Item -Force $tmp; throw ('Gradle wrapper JAR SHA-256 mismatch. Expected: '+$expected+' Actual: '+$actual) }; Move-Item -Force $tmp $out"
if %ERRORLEVEL% neq 0 goto fail

:wrapperJarPresent

set DEFAULT_JVM_OPTS=-Dfile.encoding=UTF-8 "-Xmx64m" "-Xms64m"

if defined JAVA_HOME goto findJavaFromJavaHome

set JAVA_EXE=java.exe
%JAVA_EXE% -version >NUL 2>&1
if %ERRORLEVEL% equ 0 goto execute

echo. 1>&2
echo ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH. 1>&2
echo. 1>&2
echo Please set the JAVA_HOME variable in your environment to match the 1>&2
echo location of your Java installation. 1>&2

goto fail

:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%/bin/java.exe

if exist "%JAVA_EXE%" goto execute

echo. 1>&2
echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME% 1>&2
echo. 1>&2
echo Please set the JAVA_HOME variable in your environment to match the 1>&2
echo location of your Java installation. 1>&2

goto fail

:execute
@rem Setup the command line

set CLASSPATH=%WRAPPER_JAR%

@rem Execute Gradle
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*

:end
if %ERRORLEVEL% equ 0 goto mainEnd

:fail
set EXIT_CODE=%ERRORLEVEL%
if %EXIT_CODE% equ 0 set EXIT_CODE=1
if not ""=="%GRADLE_EXIT_CONSOLE%" exit %EXIT_CODE%
exit /b %EXIT_CODE%

:mainEnd
if "%OS%"=="Windows_NT" endlocal

:omega
