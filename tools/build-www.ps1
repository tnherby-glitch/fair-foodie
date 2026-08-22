# Builds the Capacitor web bundle: copies the static site into www/.
# The app is a no-build static site, so this is a straight copy of the
# runtime files (everything the browser loads, nothing else).
$root = Split-Path -Parent $PSScriptRoot
$www  = Join-Path $root 'www'

if (Test-Path $www) { Remove-Item $www -Recurse -Force }
New-Item -ItemType Directory -Path $www | Out-Null

# top-level files the app serves
foreach ($f in @('index.html', '404.html', 'manifest.webmanifest', 'privacy.html', 'terms.html')) {
  $src = Join-Path $root $f
  if (Test-Path $src) { Copy-Item $src $www }
}
# asset directories
foreach ($d in @('css', 'js', 'assets', 'photos', 'vendor')) {
  $src = Join-Path $root $d
  if (Test-Path $src) { Copy-Item $src (Join-Path $www $d) -Recurse }
}

$size = (Get-ChildItem $www -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ("www built: {0:N1} MB" -f $size)
