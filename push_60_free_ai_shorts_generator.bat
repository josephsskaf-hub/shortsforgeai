@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "app\free-ai-shorts-generator\page.tsx" "app\sitemap.ts" "public\llms.txt" "scripts\measure-growth-funnel.mjs" "docs\growth\2026-07-23-free-ai-shorts-generator.md" "push_60_free_ai_shorts_generator.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #60 add free AI Shorts generator page"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_60_COMPLETE
pause
exit /b 0

:failed
echo PUSH_60_FAILED
pause
exit /b 1
