@echo off
cd /d "%~dp0"
taskkill /f /im git.exe 2>nul
ping -n 2 127.0.0.1 >nul
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/(dashboard)/generate/GenerateClient.tsx
git commit -m "fix(#266): remove Media & Quality cards from Cinematic mode — quality locked to basic_ai, no selector shown"
git push origin main
pause
