@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git checkout stage/render-v2 2>nul || git checkout -b stage/render-v2
git add app/HomePageClient.tsx
git add components/MobileNav.tsx
git commit -m "fix: remove dropdown — 4 clean nav links (Generator, Thumbnail, My Videos, Pricing)"
git push origin stage/render-v2
pause
