@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
del /f /q .git\index.lock 2>nul
git add lib/pixabayMusic.ts
git status
git commit -m "fix(#294): remove hardcoded Pixabay CDN fallbacks (403) — music requires PIXABAY_API_KEY"
git push origin main
echo.
echo === Push #294 complete. Check above for errors. ===
pause
