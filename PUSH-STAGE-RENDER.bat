@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git checkout stage/render-v2 2>nul || git checkout -b stage/render-v2
git add app/(dashboard)/generate/GenerateClient.tsx
git commit -m "feat: render UI v2 — ring progress, elapsed timer, hide internals, ShortsForgeAI branding"
git push origin stage/render-v2
pause
