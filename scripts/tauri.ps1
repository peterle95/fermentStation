param(
  [Parameter(Mandatory)]
  [ValidateSet("dev", "build")]
  [string]$Mode
)

$vsDevCmd = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

if (!(Test-Path -LiteralPath $vsDevCmd)) {
  throw "Visual Studio Build Tools with the C++ workload is required."
}

$command = "set `"PATH=$env:USERPROFILE\.cargo\bin;%PATH%`" && call `"$vsDevCmd`" >nul && npm exec tauri $Mode"
cmd.exe /d /c $command
exit $LASTEXITCODE
