@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
del /f /q .git\index.lock 2>nul

git add "app/(dashboard)/generate/GenerateClient.tsx"
git commit -m "feat(#296): redesign result page actions (big download, WhatsApp, YouTube Studio link)"
git push origin main
echo.
echo === PUSH-296 done ===
pause
