@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git add app/api/compose/status/[renderId]/route.ts
git commit -m "fix: restore route.ts to correct 412-line version (was truncated at 357 lines)"
git push origin main
pause
