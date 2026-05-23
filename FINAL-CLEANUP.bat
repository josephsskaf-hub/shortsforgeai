@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
if exist broad del /f broad
if exist FIX-BATFILES.bat del /f FIX-BATFILES.bat
git add -A
git status
git diff --cached --stat
git commit -m "fix: remove leftover garbage files and fix bat commit format"
git push origin main
pause
