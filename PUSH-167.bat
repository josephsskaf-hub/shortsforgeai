@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo Cleaning git state...
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\rebase-merge" rmdir /s /q ".git\rebase-merge"
if exist ".git\rebase-apply" rmdir /s /q ".git\rebase-apply"
git rebase --abort 2>nul
git reset HEAD 2>nul
echo.
echo Adding files...
git add "app/(dashboard)/generate/GenerateClient.tsx" PUSH-167.bat
git status
echo.
echo Committing...
git commit -m "ui: redesign ModeSelector — remove price, feature bullets, cleaner cards (#167)"
echo.
echo Pushing...
git push origin main
echo.
echo Done! Pushed ModeSelector UX/UI redesign.
pause
