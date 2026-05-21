@echo off
cd /d "%~dp0"
if exist ".git\index.lock" del /f /q ".git\index.lock"
git add app\HomePageClient.tsx
git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "Push #133 - Remove HeroVideo panel from homepage hero"
)
git fetch origin
git merge origin/main -X ours --no-edit
git push origin main
echo.
echo FEITO!
pause
