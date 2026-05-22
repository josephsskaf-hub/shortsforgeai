@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git checkout stage/render-v2 2>nul || git checkout -b stage/render-v2
git add components/Sidebar.tsx
git commit -m "fix: sidebar cyan palette — settingsOpen + sign-in button blue->cyan"
git push origin stage/render-v2
pause
