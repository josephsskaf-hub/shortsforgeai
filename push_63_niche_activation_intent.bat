@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "app\free-ai-shorts\page.tsx" "app\free-ai-shorts\[niche]\page.tsx" "scripts\measure-growth-funnel.mjs" "docs\growth\2026-07-23-niche-activation-intent.md" "push_63_niche_activation_intent.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #63 carry niche prompts into activation"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_63_COMPLETE
pause
exit /b 0

:failed
echo PUSH_63_FAILED
pause
exit /b 1
