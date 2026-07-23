@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "docs\growth\2026-07-23-free-ai-shorts-generator.md" "push_61_acquisition_log_update.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #61 record free generator acquisition evidence"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_61_COMPLETE
pause
exit /b 0

:failed
echo PUSH_61_FAILED
pause
exit /b 1
