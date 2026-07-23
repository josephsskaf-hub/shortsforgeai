@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "app\api\generate-video-fast\route.ts" "docs\growth\2026-07-22-22h-fast-activation-compose-hotfix.md" "push_57_fast_activation_compose_hotfix.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #57 keep Fast activation stock-only"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_57_COMPLETE
pause
exit /b 0

:failed
echo PUSH_57_FAILED
pause
exit /b 1
