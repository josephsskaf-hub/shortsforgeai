@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
git add lib/pexels.ts
git commit -m "fix(#245): positive slug guard + wider search for space/aviation queries"
git push origin main
pause
