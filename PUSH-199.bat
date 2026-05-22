@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: restore truncated files + toLocaleString en-US + timeout fixes (push #199)"
git push origin main
pause
