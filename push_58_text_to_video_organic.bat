@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "app\text-to-video-shorts\page.tsx" "app\sitemap.ts" "public\llms.txt" "docs\growth\2026-07-23-text-to-video-organic-page.md" "push_58_text_to_video_organic.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #58 add text-to-video organic page"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_58_COMPLETE
pause
exit /b 0

:failed
echo PUSH_58_FAILED
pause
exit /b 1
