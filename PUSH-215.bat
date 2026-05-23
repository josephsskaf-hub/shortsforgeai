@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: push 215 remove all Pexels CDN hotlinks that 403 server-side, require PEXELS_API_KEY for real footage"
git push origin main
pause
