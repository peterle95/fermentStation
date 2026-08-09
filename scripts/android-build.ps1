$javaHome = [Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
$androidHome = [Environment]::GetEnvironmentVariable("ANDROID_HOME", "User")

if (!$javaHome -or !$androidHome) {
  throw "JAVA_HOME and ANDROID_HOME must be configured for Android builds."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidHome
$env:ANDROID_SDK_ROOT = $androidHome
$androidProject = Join-Path $PSScriptRoot "..\android"

& (Join-Path $androidProject "gradlew.bat") -p $androidProject :app:assembleDebug
exit $LASTEXITCODE
