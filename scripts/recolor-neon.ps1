# NEON RECOLOR (12/06) - site-wide palette migration.
# Maps every hardcoded navy/blue-era color to the new violet-black neon
# palette across app/**/*.tsx and components/**/*.tsx (UI only - app/api is
# EXCLUDED so transactional email HTML keeps its tested look).
# Reads/writes UTF-8 WITHOUT BOM so multibyte chars are never mangled.
# Idempotent: running twice is a no-op.
# v3 - ASCII-only source: PowerShell 5.1 reads BOM-less .ps1 as ANSI, so any
# non-ASCII char in THIS file breaks parsing. Target files are still handled
# as real UTF-8 via the explicit encoding below.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$map = @(
  @('#0B1120', '#0C0719'), @('#0b1120', '#0c0719'),
  @('#0B1020', '#0A0618'), @('#0b1020', '#0a0618'),
  @('#151C2F', '#120B26'), @('#151c2f', '#120b26'),
  @('#05070D', '#040209'), @('#05070d', '#040209'),
  @('#0D1226', '#0D0722'), @('#0d1226', '#0d0722'),
  @('#1D4ED8', '#6D28D9'), @('#1d4ed8', '#6d28d9'),
  @('#2563EB', '#7C3AED'), @('#2563eb', '#7c3aed'),
  @('#3B82F6', '#8B5CF6'), @('#3b82f6', '#8b5cf6'),
  @('#60A5FA', '#A78BFA'), @('#60a5fa', '#a78bfa'),
  @('#93C5FD', '#C4B5FD'), @('#93c5fd', '#c4b5fd'),
  @('59,130,246', '139,92,246'),
  @('59, 130, 246', '139, 92, 246'),
  @('37,99,235', '124,58,237'),
  @('37, 99, 235', '124, 58, 237'),
  @('96,165,250', '167,139,250'),
  @('96, 165, 250', '167, 139, 250'),
  @('29,78,216', '109,40,217'),
  @('29, 78, 216', '109, 40, 217'),
  @('147,197,253', '196,181,253'),
  @('147, 197, 253', '196, 181, 253'),
  @('blue-400', 'violet-400'),
  @('blue-500', 'violet-500'),
  @('blue-600', 'violet-600')
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
Write-Host ("NEON RECOLOR done - " + $changed + " file(s) updated, " + $targets.Count + " scanned.")
