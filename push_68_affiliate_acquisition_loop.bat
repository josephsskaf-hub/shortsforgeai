@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "app\api\stripe\checkout\route.ts" "app\api\stripe\webhook\route.ts" "app\partners\page.tsx" "app\api\affiliate\apply\route.ts" "app\api\admin\funnel\route.ts" "components\Footer.tsx" "public\llms.txt" "app\sitemap.ts" "package.json" "scripts\measure-affiliate-funnel.mjs" "docs\growth\2026-07-23-affiliate-acquisition-loop.md" "push_68_affiliate_acquisition_loop.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #68 activate measurable affiliate acquisition"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_68_COMPLETE
pause
exit /b 0

:failed
echo PUSH_68_FAILED
pause
exit /b 1
