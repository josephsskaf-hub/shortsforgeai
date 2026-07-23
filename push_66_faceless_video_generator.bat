@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "app\faceless-video-generator\page.tsx" "app\sitemap.ts" "app\api\admin\funnel\route.ts" "app\free-ai-shorts-generator\page.tsx" "app\facts\page.tsx" "scripts\measure-growth-funnel.mjs" "docs\growth\2026-07-23-faceless-video-generator.md" "push_66_faceless_video_generator.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #66 add faceless video generator acquisition page"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_66_COMPLETE
pause
exit /b 0

:failed
echo PUSH_66_FAILED
pause
exit /b 1
