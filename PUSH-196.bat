@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
git add -A
git commit -m "fix: smoke test fixes — remove 50% Off banner, update footer version (push #196)"
git push origin main
pause
