@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: push 213 rocket priority mode - NASA verified footage, skip Pexels for space"
git push origin main
pause
