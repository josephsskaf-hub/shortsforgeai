@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
git commit --allow-empty -m "Push #328: trigger Vercel webhook after GitHub reconnect"
git push origin main
echo Done!
pause
