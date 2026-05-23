@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul

REM Delete the accidental empty garbage file
if exist 0.6 del /f 0.6

REM Stage the deletion
git rm --cached 0.6 2>nul
git add -A

git commit -m "fix: cleanup - remove accidental 0.6 garbage file from Push 212"
git push origin main
pause
