@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/HomePageClient.tsx
git commit -m "fix(#252): full-width nav + footer with matching px-6 sm:px-10 padding; remove Home from footer links"
git push origin main
pause
