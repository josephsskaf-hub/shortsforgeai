@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add lib/compose.ts lib/stockLibrary.ts
git commit -m "fix(#246): restore truncated compose.ts + stockLibrary.ts; Vercel builds were failing due to files cut off mid-syntax"
git push origin main
pause
