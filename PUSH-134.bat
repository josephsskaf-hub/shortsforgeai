@echo off
cd /d "%~dp0"
if exist ".git\index.lock" del /f /q ".git\index.lock"
git add app\(dashboard)\admin\metrics\page.tsx
git add app\(dashboard)\admin\users\page.tsx
git add app\(dashboard)\admin\funnel\page.tsx
git add app\api\admin\users\route.ts
git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "Push #134 - Fix admin access: add josephskaf@gmail.com to ADMIN_EMAILS"
)
git fetch origin
git merge origin/main -X ours --no-edit
git push origin main
echo FEITO!
pause
