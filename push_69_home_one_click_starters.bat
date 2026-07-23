@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "app\HomeTopicForm.tsx" "app\KineoLanding.tsx" "scripts\measure-growth-funnel.mjs" "scripts\inspect-activation-failures.mjs" "package.json" "docs\growth\2026-07-23-home-one-click-starters.md" "push_69_home_one_click_starters.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #69 turn homepage ideas into one-click starts"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_69_COMPLETE
pause
exit /b 0

:failed
echo PUSH_69_FAILED
pause
exit /b 1
