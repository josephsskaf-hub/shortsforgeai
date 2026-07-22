@echo off
setlocal
cd /d C:\Users\win\Downloads\kineo

git add -- "app/(dashboard)/thumbnail-generator/page.tsx" "app/(dashboard)/thumbnail-generator/ThumbnailGeneratorClient.tsx" "push_54_owner_thumbnail_quota.bat"
if errorlevel 1 exit /b %errorlevel%

git diff --cached --check
if errorlevel 1 exit /b %errorlevel%

git commit -m "PUSH #54 grant owner 100 daily thumbnail generations"
if errorlevel 1 exit /b %errorlevel%

git push origin main
if errorlevel 1 exit /b %errorlevel%

git status --short --branch
endlocal
