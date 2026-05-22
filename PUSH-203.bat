@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "feat: topic-anchored search keywords + larger Pexels clips for better visual match (push #203)"
git push origin main
pause
