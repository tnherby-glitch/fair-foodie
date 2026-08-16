# Deploy: stamp asset versions (cache busting), commit, push main + gh-pages.
# Usage: powershell -File tools\deploy.ps1 -Message "What changed"
param([string]$Message = "Deploy")

$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot
$idx = Join-Path $proj "index.html"

# stamp every ?v= with the current unix time so the CDN serves fresh assets immediately
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$t = [System.IO.File]::ReadAllText($idx, [System.Text.Encoding]::UTF8)
$t = [regex]::Replace($t, '\?v=[0-9]+', ('?v=' + $stamp))
[System.IO.File]::WriteAllText($idx, $t, (New-Object System.Text.UTF8Encoding($false)))

$env:GIT_TERMINAL_PROMPT = '1'
git -C $proj add -A
git -C $proj commit -q -m ($Message + "`n`nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>")
git -C $proj push origin main
git -C $proj push -f origin main:gh-pages
git -C $proj log --oneline -1
Write-Output ("deployed with asset stamp v=" + $stamp)