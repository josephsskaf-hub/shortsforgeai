@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/HomePageClient.tsx
git commit -m "fix(#250): align nav to max-w-6xl container; fix exit-survey to use localStorage + 30-day cooldown + permanent suppress after submit"
git push origin main
pause
