@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/api/stripe/webhook/route.ts
git commit -m "fix(#265b): restore webhook truncation — full file with trial removal applied correctly (331 lines, no more $0 trial credits)"
git push origin main
pause
