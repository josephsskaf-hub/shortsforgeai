@echo off
cd /d "%~dp0"
taskkill /f /im git.exe 2>nul
ping -n 2 127.0.0.1 >nul
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/api/stripe/webhook/route.ts
git commit -m "fix(#265b): restore webhook truncation — full 331-line file, no trial credits, checkout now always grants full plan credits immediately"
git push origin main
pause
