@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "app\(dashboard)\generate\GenerateClient.tsx" "scripts\measure-growth-funnel.mjs" "docs\growth\2026-07-23-abandoned-first-render-recovery.md" "push_64_abandoned_first_render_recovery.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #64 recover abandoned first renders"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_64_COMPLETE
pause
exit /b 0

:failed
echo PUSH_64_FAILED
pause
exit /b 1
