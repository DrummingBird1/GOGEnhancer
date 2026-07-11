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

$manifest = Get-Content (Join-Path $source "manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version

# Version history: before overwriting the previous build, read the version
# baked into its manifest.json and, if it differs from the one we're about to
# build, tuck the old zip into dist/archive/ so a full history is preserved.
# Same-version rebuilds just overwrite (they aren't a new release).
if (Test-Path $resolvedOut) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $prevVersion = $null
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($resolvedOut)
        try {
            $entry = $zip.Entries | Where-Object { $_.FullName -eq "manifest.json" } | Select-Object -First 1
            if ($entry) {
                $reader = New-Object System.IO.StreamReader($entry.Open())
                try { $prevVersion = ($reader.ReadToEnd() | ConvertFrom-Json).version } finally { $reader.Dispose() }
            }
        } finally { $zip.Dispose() }
    } catch { }

    if ($prevVersion -and $prevVersion -ne $version) {
        $archiveDir = Join-Path $outDir "archive"
        if (-not (Test-Path $archiveDir)) {
            New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
        }
        $archived = Join-Path $archiveDir "gog-enhancer-v$prevVersion.zip"
        Move-Item $resolvedOut $archived -Force
        Write-Output "Archived previous build (v$prevVersion) -> $archived"
    } else {
        Remove-Item $resolvedOut -Force
    }
}

# Push into source so relative paths in the zip don't carry an outer dir.
Push-Location $source
try {
    Compress-Archive -Path $include -DestinationPath $resolvedOut -CompressionLevel Optimal
} finally {
    Pop-Location
}

$sizeKB = [Math]::Round((Get-Item $resolvedOut).Length / 1KB, 1)
Write-Output "Built $resolvedOut (v$version, $sizeKB KB)"
