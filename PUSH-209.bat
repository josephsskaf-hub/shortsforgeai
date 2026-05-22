@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: subtitle sync — apply 0.4s lead to Whisper timestamps (push #209)"
git push origin main
pause
