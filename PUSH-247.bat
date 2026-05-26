@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/HomePageClient.tsx
git commit -m "fix(#247): remove 'YOUR PROMPT / Elon Musk' card from homepage Real Output section"
git push origin main
pause
