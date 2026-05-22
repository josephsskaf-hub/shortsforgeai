@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git add app/(dashboard)/my-videos/MyVideosClient.tsx
git commit -m "fix: My Videos — 5-col grid (smaller cards) + clean video titles (strip prompt prefix)"
git push origin main
pause
