Set-Location "C:\Users\win\Downloads\shortsforgeai"
Write-Host "=== Git Log (before push) ===" -ForegroundColor Cyan
git log --oneline -3
Write-Host ""
Write-Host "=== Pushing to GitHub... ===" -ForegroundColor Cyan
$result = git push origin main 2>&1
Write-Host $result
Write-Host ""
Write-Host "=== Git Log (after push) ===" -ForegroundColor Cyan
git log --oneline -3
Write-Host ""
Write-Host "Press Enter to close..." -ForegroundColor Yellow
Read-Host
