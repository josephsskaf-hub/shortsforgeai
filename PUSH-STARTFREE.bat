@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git checkout stage/render-v2 2>nul || git checkout -b stage/render-v2
git add app/HomePageClient.tsx
git commit -m "fix: rename Sign Up -> Start Free on navbar (desktop + mobile)"
git push origin stage/render-v2
pause
