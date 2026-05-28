@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
del /f /q .git\index.lock 2>nul

git add app/layout.tsx
git commit -m "seo(#297): improve meta title + description for Google Ads Quality Score"
git push origin main
echo.
echo === PUSH-297 done ===
pause
