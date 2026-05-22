@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "feat: cross-dissolve transitions between clips, caption fade-in, higher-res Pexels footage (push #202)"
git push origin main
pause
