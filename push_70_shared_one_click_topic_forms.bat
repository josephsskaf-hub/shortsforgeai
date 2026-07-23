@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "app\youtube-shorts-from-topic\TopicGeneratorForm.tsx" "scripts\measure-growth-funnel.mjs" "docs\growth\2026-07-23-shared-one-click-topic-forms.md" "push_70_shared_one_click_topic_forms.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #70 make organic topic examples one-click"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_70_COMPLETE
pause
exit /b 0

:failed
echo PUSH_70_FAILED
pause
exit /b 1
