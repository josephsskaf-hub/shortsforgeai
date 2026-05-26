@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/HomePageClient.tsx
git commit -m "fix(#251): align footer links with nav — flex-1 justify-center on both center groups; min-w balances logo/copyright columns"
git push origin main
pause
