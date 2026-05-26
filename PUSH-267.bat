@echo off
cd /d "%~dp0"
taskkill /f /im git.exe 2>nul
ping -n 2 127.0.0.1 >nul
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/pricing/page.tsx
git commit -m "fix(#267): remove Free $0 card from /pricing page — 2-col Basic+Pro grid, remove free banner, update FAQ"
git push origin main
pause
