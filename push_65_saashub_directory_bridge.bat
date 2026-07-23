@echo off
setlocal
cd /d "C:\Users\win\Downloads\kineo"

git status --short --untracked-files=no
git add -- "app\from-saashub\page.tsx" "app\from-saashub\SaaSHubBridgeClient.tsx" "app\api\admin\funnel\route.ts" "scripts\measure-growth-funnel.mjs" "docs\growth\2026-07-23-saashub-directory-bridge.md" "push_65_saashub_directory_bridge.bat"
if errorlevel 1 goto :failed

git diff --cached --check
if errorlevel 1 goto :failed

git commit -m "PUSH #65 add SaaSHub directory bridge"
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo PUSH_65_COMPLETE
pause
exit /b 0

:failed
echo PUSH_65_FAILED
pause
exit /b 1
