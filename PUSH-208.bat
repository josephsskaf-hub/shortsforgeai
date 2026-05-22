@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "feat: add 90s duration, remove 30s, TikTok support, dynamic scene cap (push #208)"
git push origin main
pause
