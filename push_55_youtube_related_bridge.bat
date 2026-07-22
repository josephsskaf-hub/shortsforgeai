@echo off
setlocal
cd /d C:\Users\win\Downloads\kineo

git add -- "app/(dashboard)/generate/GenerateClient.tsx" "app/from-youtube/page.tsx" "app/from-youtube/YouTubeBridgeClient.tsx" "components/PricingCards.tsx" "scripts/measure-growth-funnel.mjs" "docs/growth/2026-07-22-push55-youtube-related-bridge.md" "push_55_youtube_related_bridge.bat"
if errorlevel 1 exit /b %errorlevel%

git diff --cached --check
if errorlevel 1 exit /b %errorlevel%

git commit -m "PUSH #55 build an attributable YouTube buyer bridge"
if errorlevel 1 exit /b %errorlevel%

git push origin main
if errorlevel 1 exit /b %errorlevel%

git status --short --branch
endlocal
