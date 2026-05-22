@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: video duration driven by real TTS audio — no more black screen or cut-off narration (push #200)"
git push origin main
pause
