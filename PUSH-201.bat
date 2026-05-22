@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: remove hardcoded 35-second references from loader, metadata, scenes prompt (push #201)"
git push origin main
pause
