# MONO PREMIUM RECOLOR (12/06) - high-end clean pass.
# Neutralizes the green-tinted BACKGROUNDS to graphite across app/**/*.tsx and
# components/**/*.tsx (app/api excluded). Emerald stays as the single ACCENT
# (buttons, active states, numbers) - this pass only de-tints surfaces and
# retires the lime spice. ASCII-only source; targets written UTF-8 no BOM.
# Idempotent.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$map = @(
  # green-black surfaces -> neutral graphite
  @('#020D0A', '#0A0A0B'), @('#020d0a', '#0a0a0b'),
  @('#041711', '#0F0F10'), @('#041711', '#0F0F10'),
  @('#051D15', '#121214'), @('#051d15', '#121214'),
  @('#07271D', '#131316'), @('#07271d', '#131316'),
  @('#093325', '#17171A'), @('#093325', '#17171A'),
  @('#03130E', '#0C0C0E'), @('#03130e', '#0c0c0e'),
  @('#062017', '#101013'), @('#062017', '#101013'),
  # hero phone scene shades -> graphite
  @('#0B2E22', '#1A1A1D'), @('#0b2e22', '#1a1a1d'),
  @('#0A2C1E', '#19191C'), @('#0a2c1e', '#19191c'),
  @('#07301F', '#1B1B1E'), @('#07301f', '#1b1b1e'),
  @('#03130D', '#0D0D0F'), @('#03130d', '#0d0d0f'),
  @('#02100B', '#0A0A0C'), @('#02100b', '#0a0a0c'),
  @('#03150E', '#0E0E10'), @('#03150e', '#0e0e10'),
  @('#020D09', '#09090B'), @('#020d09', '#09090b'),
  # retire the lime spice -> mint
  @('#A3E635', '#34D399'), @('#a3e635', '#34d399'),
  @('#D9F99D', '#A7F3D0'), @('#d9f99d', '#a7f3d0'),
  @('163,230,53', '52,211,153'), @('163, 230, 53', '52, 211, 153')
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$targets = @(
  Get-ChildItem -Path (Join-Path $root 'app'), (Join-Path $root 'components') -Recurse -Include *.tsx -File |
    Where-Object { $_.FullName -notmatch '\\app\\api\\' }
)

$changed = 0
foreach ($f in $targets) {
  $text = [System.IO.File]::ReadAllText($f.FullName)
  $orig = $text
  foreach ($pair in $map) {
    $text = $text.Replace($pair[0], $pair[1])
  }
  if ($text -ne $orig) {
    [System.IO.File]::WriteAllText($f.FullName, $text, $utf8NoBom)
    $changed++
    Write-Host ("recolored: " + $f.FullName.Substring($root.Length + 1))
  }
}
Write-Host ""
Write-Host ("MONO PREMIUM RECOLOR done - " + $changed + " file(s) updated, " + $targets.Count + " scanned.")
