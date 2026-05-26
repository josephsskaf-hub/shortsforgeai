@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #243 — Fix aviation Pexels fallback + cloudinary generic ===
if exist .git\index.lock del /f .git\index.lock
git push origin main
echo === Done! Push #243 deployed ===
pause
