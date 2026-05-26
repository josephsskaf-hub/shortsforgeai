@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #242 — Fix video duration + Pexels fallback queries ===
if exist .git\index.lock del /f .git\index.lock
git push origin main
echo === Done! Push #242 deployed ===
pause
