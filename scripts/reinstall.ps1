[CmdletBinding()]
param(
    [string]$CodeCommand = "code",
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $projectRoot "package.json"
$packageJson = Get-Content -Raw -LiteralPath $packageJsonPath | ConvertFrom-Json
$extensionId = "$($packageJson.publisher).$($packageJson.name)"
$vsixPath = Join-Path $projectRoot "$($packageJson.name)-$($packageJson.version).vsix"
$buildScript = Join-Path $PSScriptRoot "build-package.ps1"

& $buildScript -SkipInstall:$SkipInstall

Write-Host "Uninstalling $extensionId (if installed)..."
& $CodeCommand --uninstall-extension $extensionId
if ($LASTEXITCODE -ne 0) {
    Write-Warning "The existing extension could not be uninstalled; continuing with a forced install."
}

Write-Host "Installing $vsixPath..."
& $CodeCommand --install-extension $vsixPath --force
if ($LASTEXITCODE -ne 0) {
    throw "VS Code extension installation failed with exit code $LASTEXITCODE."
}

Write-Host "Installed $extensionId from $vsixPath."
