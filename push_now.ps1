Set-Location "C:\Users\win\Downloads\shortsforgeai"
Write-Host "=== Git add ===" -ForegroundColor Cyan
git add app/page.tsx lib/stripe.ts app/api/generate/route.ts push_fix_build.bat push_now.ps1
Write-Host "=== Git commit ===" -ForegroundColor Cyan
git commit -m "fix: use client home page + stripe safe init + generate timeout 25s maxDuration 60s"
Write-Host "=== Git push ===" -ForegroundColor Cyan
git push origin main
Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
git log --oneline -3
Read-Host "Pressione Enter para fechar"
