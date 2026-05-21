Set-Location "C:\Users\win\Downloads\shortsforgeai"
Write-Host "=== Force pushing fix #167 (full file) ===" -ForegroundColor Cyan
git log --oneline -3
Write-Host ""
$result = git push origin main --force 2>&1
Write-Host $result
Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Read-Host "Press Enter to close"
