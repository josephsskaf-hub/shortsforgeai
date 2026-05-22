@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git checkout stage/render-v2 2>nul || git checkout -b stage/render-v2
git merge main --no-ff -m "sync: bring stage up to date with main" 2>nul
git add app/HomePageClient.tsx
git add app/(dashboard)/generate/GenerateClient.tsx
git add components/Sidebar.tsx
git commit -m "feat: homepage v2 — features dropdown nav, hero bg video, 3x2 showcase grid, remove trending hooks + examples"
git push origin stage/render-v2
pause
