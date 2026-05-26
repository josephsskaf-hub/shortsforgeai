@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git commit -m "fix(#245): positive slug guard + wider Pexels search for space/aviation"
git push origin main
pause
