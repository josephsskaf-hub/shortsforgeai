@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
del /f /q .git\index.lock 2>nul

rem Remove accidental redirect files created by previous run
del /f /q "3.1" 2>nul
del /f /q "130-150" 2>nul
del /f /q "175-200" 2>nul
del /f /q "265-295" 2>nul

git add lib/compose.ts lib/openai.ts app/api/generate-video-fast/route.ts
git commit -m "fix(#295): correct video duration + B-roll quality (3 bugs)"
git push origin main
echo.
echo === PUSH-295 done ===
pause
