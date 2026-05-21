@echo off
cd /d "%~dp0"
if exist ".git\index.lock" del /f /q ".git\index.lock"
git add -A
git commit -m "Push #127 - Fix video showcase: use Mixkit URLs + fix preload attribute"
git push origin main
echo Done! Check Vercel.
pause
