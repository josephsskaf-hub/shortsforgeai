@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "docs\growth\2026-07-23-text-to-video-organic-page.md" "push_59_acquisition_log_update.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #59 record text-to-video acquisition evidence"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_59_COMPLETE
pause
exit /b 0

:failed
echo PUSH_59_FAILED
pause
exit /b 1
