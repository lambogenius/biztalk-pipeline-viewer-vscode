[CmdletBinding()]
param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $projectRoot "package.json"
$packageJson = Get-Content -Raw -LiteralPath $packageJsonPath | ConvertFrom-Json
$extensionId = "$($packageJson.publisher).$($packageJson.name)"
$vsixPath = Join-Path $projectRoot "$($packageJson.name)-$($packageJson.version).vsix"

Push-Location $projectRoot
try {
    if (-not $SkipInstall) {
        Write-Host "Installing dependencies..."
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed with exit code $LASTEXITCODE."
        }
    }

    Write-Host "Checking and packaging $extensionId..."
    & npm.cmd run package -- --out $vsixPath
    if ($LASTEXITCODE -ne 0) {
        throw "Packaging failed with exit code $LASTEXITCODE."
    }

    Write-Host "Created $vsixPath."
}
finally {
    Pop-Location
}
