#requires -Version 5.1
<#
.SYNOPSIS
    Build a Chrome Web Store-ready zip from the extension source.

.DESCRIPTION
    Produces dist/gog-enhancer-webstore.zip from the extension/ folder —
    only the extension files (code, manifest, icons). README/PRIVACY/LICENSE,
    the store/ folder (STORE_LISTING + screenshots), tests, and tooling all
    stay out of the package.

.EXAMPLE
    .\build.ps1
    # writes dist/gog-enhancer-webstore.zip

.EXAMPLE
    .\build.ps1 -OutPath dist/gog-enhancer-v2.2.0.zip
#>
param(
    [string]$OutPath = "dist/gog-enhancer-webstore.zip"
)

$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "extension"
if (-not (Test-Path $source)) {
    throw "Extension folder not found: $source"
}

$resolvedOut = if ([System.IO.Path]::IsPathRooted($OutPath)) {
    $OutPath
} else {
    Join-Path $PSScriptRoot $OutPath
}

# Make sure the output directory exists (dist/ on a fresh checkout otherwise).
$outDir = Split-Path -Parent $resolvedOut
if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
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
