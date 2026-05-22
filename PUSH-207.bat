@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "feat: hero background video — dark cinematic Pexels clip, opacity 0.22, tuned gradient overlay (push #207)"
git push origin main
pause
