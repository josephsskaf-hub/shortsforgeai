@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: analyze-idea timeout — maxDuration 30→60s, OpenAI 25→28s, client abort 30→50s (push #198)"
git push origin main
pause
