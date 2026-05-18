#requires -Version 5.1
<#
.SYNOPSIS
    Build a Chrome Web Store-ready zip from gog-enhancer-source/.

.DESCRIPTION
    Produces a zip at the repo root containing only the extension files
    (code, manifest, icons). README/PRIVACY/STORE_LISTING/LICENSE and the
    screenshots stay out of the package.

.EXAMPLE
    .\build.ps1
    # writes gog-enhancer-webstore.zip

.EXAMPLE
    .\build.ps1 -OutPath gog-enhancer-v2.0.3.zip
#>
param(
    [string]$OutPath = "gog-enhancer-webstore.zip"
)

$ErrorActionPreference = "Stop"

$source = $PSScriptRoot

$resolvedOut = if ([System.IO.Path]::IsPathRooted($OutPath)) {
    $OutPath
} else {
    Join-Path $PSScriptRoot $OutPath
}

# What goes in the zip. Docs (*.md) and screenshots (*.png at root) stay out.
$include = @(
    "background",
    "content",
    "icons",
    "lib",
    "onboarding",
    "options",
    "popup",
    "tags",
    "manifest.json"
)

foreach ($name in $include) {
    $p = Join-Path $source $name
    if (-not (Test-Path $p)) {
        throw "Missing required path: $p"
    }
}

if (Test-Path $resolvedOut) {
    Remove-Item $resolvedOut -Force
}

$manifest = Get-Content (Join-Path $source "manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version

# Push into source so relative paths in the zip don't carry an outer dir.
Push-Location $source
try {
    Compress-Archive -Path $include -DestinationPath $resolvedOut -CompressionLevel Optimal
} finally {
    Pop-Location
}

$sizeKB = [Math]::Round((Get-Item $resolvedOut).Length / 1KB, 1)
Write-Output "Built $resolvedOut (v$version, $sizeKB KB)"
