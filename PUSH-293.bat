@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
del /f /q .git\index.lock 2>nul
git add lib/pixabayMusic.ts
git add lib/compose.ts
git add app/api/compose/route.ts
git status
git commit -m "feat(#293): add Pixabay background music track — phonk at 18pct volume"
git push origin main
echo.
echo === Push #293 complete. Check above for errors. ===
pause
