@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "app\KineoLanding.tsx" "components\Footer.tsx" "app\facts\page.tsx" "app\api\admin\funnel\route.ts" "docs\growth\2026-07-23-internal-organic-distribution.md" "push_62_internal_organic_distribution.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #62 strengthen internal organic distribution"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_62_COMPLETE
pause
exit /b 0

:failed
echo PUSH_62_FAILED
pause
exit /b 1
