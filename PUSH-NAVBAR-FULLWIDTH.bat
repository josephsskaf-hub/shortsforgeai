@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git checkout stage/render-v2 2>nul || git checkout -b stage/render-v2
git add app/HomePageClient.tsx
git commit -m "feat: navbar full-width layout — logo far left, nav centre, CTA far right, +20pct font"
git push origin stage/render-v2
pause
