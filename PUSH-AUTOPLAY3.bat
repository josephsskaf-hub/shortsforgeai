@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git add app/HomePageClient.tsx
git commit -m "feat: autoplay videos full time on homepage showcase sections"
git push origin main
pause
