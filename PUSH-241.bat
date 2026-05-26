@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #241 — Full pipeline audit: query pairing, footage coverage ===
if exist .git\index.lock del /f .git\index.lock
git push origin main
echo === Done! Push #241 deployed ===
pause
