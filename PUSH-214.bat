@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: push 214 remove NASA SVS urls that 403 server-side, use Pexels CDN rocket clips as primary"
git push origin main
pause
