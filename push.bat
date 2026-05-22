@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
git add -A
git commit -m "Dashboard: real-time polling, video download tracking"
git push origin main
pause
