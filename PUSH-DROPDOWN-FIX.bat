@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git checkout stage/render-v2 2>nul || git checkout -b stage/render-v2
git add app/HomePageClient.tsx
git commit -m "fix: features dropdown clickable + 4 items (Video, Thumbnail, Templates, My Videos)"
git push origin stage/render-v2
pause
