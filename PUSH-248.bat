@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/HomePageClient.tsx lib/openai.ts
git commit -m "fix(#248): remove hero bg video + '35 seconds' heading; expand caption highlight keywords for broader topic coverage"
git push origin main
pause
