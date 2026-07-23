@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "components\Footer.tsx" "public\llms.txt" "app\facts\page.tsx" "docs\growth\2026-07-23-answer-engine-distribution.md" "push_67_answer_engine_distribution.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #67 distribute faceless generator to answer engines"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_67_COMPLETE
pause
exit /b 0

:failed
echo PUSH_67_FAILED
pause
exit /b 1
