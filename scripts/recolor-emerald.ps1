# EMERALD RECOLOR (12/06) - site-wide migration to the Emerald Tech palette.
# Maps the violet-neon family AND any leftover navy/blue-era colors to
# emerald/mint on green-black, across app/**/*.tsx and components/**/*.tsx
# (app/api EXCLUDED - email HTML untouched). ASCII-only source (PS 5.1 reads
# BOM-less ps1 as ANSI). Targets written as UTF-8 without BOM. Idempotent.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$map = @(
  # violet-black backgrounds -> green-black
  @('#0C0719', '#051D15'), @('#0c0719', '#051d15'),
  @('#0A0618', '#041711'), @('#0a0618', '#041711'),
  @('#120B26', '#07271D'), @('#120b26', '#07271d'),
  @('#160E2E', '#093325'), @('#160e2e', '#093325'),
  @('#080512', '#03130E'),
  @('#0D0722', '#062017'), @('#0d0722', '#062017'),
  @('#040209', '#020D0A'),
  # navy backgrounds (in case the violet pass was skipped anywhere)
  @('#0B1120', '#051D15'), @('#0b1120', '#051d15'),
  @('#0B1020', '#041711'), @('#0b1020', '#041711'),
  @('#151C2F', '#07271D'), @('#151c2f', '#07271d'),
  @('#05070D', '#020D0A'), @('#05070d', '#020d0a'),
  @('#0D1226', '#062017'), @('#0d1226', '#062017'),
  # hero phone scene shades
  @('#1b1133', '#0B2E22'), @('#1B1133', '#0B2E22'),
  @('#1a0f24', '#0A2C1E'), @('#0e1430', '#07301F'),
  @('#07030f', '#03130D'), @('#05030c', '#02100B'),
  @('#060310', '#03150E'), @('#04020b', '#020D09'),
  # electric violet family -> emerald family
  @('#6D28D9', '#047857'), @('#6d28d9', '#047857'),
  @('#7C3AED', '#059669'), @('#7c3aed', '#059669'),
  @('#8B5CF6', '#10B981'), @('#8b5cf6', '#10b981'),
  @('#A78BFA', '#34D399'), @('#a78bfa', '#34d399'),
  @('#C4B5FD', '#6EE7B7'), @('#c4b5fd', '#6ee7b7'),
  @('#E9D5FF', '#A7F3D0'), @('#e9d5ff', '#a7f3d0'),
  @('#D8B4FE', '#6EE7B7'), @('#d8b4fe', '#6ee7b7'),
  @('#F3E8FF', '#D1FAE5'), @('#f3e8ff', '#d1fae5'),
  @('#A855F7', '#10B981'), @('#a855f7', '#10b981'),
  @('#9333EA', '#059669'), @('#9333ea', '#059669'),
  @('#6366F1', '#14B8A6'), @('#6366f1', '#14b8a6'),
  # magenta/pink spice -> lime
  @('#E879F9', '#A3E635'), @('#e879f9', '#a3e635'),
  @('#FBCFE8', '#D9F99D'), @('#fbcfe8', '#d9f99d'),
  # rgba channels
  @('139,92,246', '16,185,129'), @('139, 92, 246', '16, 185, 129'),
  @('167,139,250', '52,211,153'), @('167, 139, 250', '52, 211, 153'),
  @('124,58,237', '5,150,105'), @('124, 58, 237', '5, 150, 105'),
  @('109,40,217', '4,120,87'), @('109, 40, 217', '4, 120, 87'),
  @('196,181,253', '110,231,183'), @('196, 181, 253', '110, 231, 183'),
  @('232,121,249', '163,230,53'), @('232, 121, 249', '163, 230, 53'),
  @('236,72,153', '163,230,53'), @('236, 72, 153', '163, 230, 53'),
  @('168,85,247', '16,185,129'), @('168, 85, 247', '16, 185, 129'),
  @('99,102,241', '20,184,166'), @('99, 102, 241', '20, 184, 166'),
  # legacy blue channels (if the violet pass was skipped anywhere)
  @('59,130,246', '16,185,129'), @('59, 130, 246', '16, 185, 129'),
  @('37,99,235', '5,150,105'), @('37, 99, 235', '5, 150, 105'),
  @('96,165,250', '52,211,153'), @('96, 165, 250', '52, 211, 153'),
  @('29,78,216', '4,120,87'), @('29, 78, 216', '4, 120, 87'),
  @('147,197,253', '110,231,183'), @('147, 197, 253', '110, 231, 183'),
  # legacy blue hexes
  @('#1D4ED8', '#047857'), @('#1d4ed8', '#047857'),
  @('#2563EB', '#059669'), @('#2563eb', '#059669'),
  @('#3B82F6', '#10B981'), @('#3b82f6', '#10b981'),
  @('#60A5FA', '#34D399'), @('#60a5fa', '#34d399'),
  @('#93C5FD', '#6EE7B7'), @('#93c5fd', '#6ee7b7'),
  # tailwind utility tokens (explicit - never bare 'purple-' so CSS vars
  # like var(--purple-light) are never touched)
  @('violet-400', 'emerald-400'), @('violet-500', 'emerald-500'), @('violet-600', 'emerald-600'),
  @('blue-400', 'emerald-400'), @('blue-500', 'emerald-500'), @('blue-600', 'emerald-600'),
  @('purple-50', 'emerald-50'), @('purple-100', 'emerald-100'), @('purple-200', 'emerald-200'),
  @('purple-300', 'emerald-300'), @('purple-400', 'emerald-400'), @('purple-500', 'emerald-500'),
  @('purple-600', 'emerald-600')
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
Write-Host ("EMERALD RECOLOR done - " + $changed + " file(s) updated, " + $targets.Count + " scanned.")
