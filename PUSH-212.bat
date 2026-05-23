@echo off
REM Push #212 - Verified Visual Asset Whitelist (no toy rockets)
REM Single-line commit message to avoid CMD multi-line parsing errors
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: push 212 verified visual asset whitelist - no toy rockets"
git push origin main
pause
