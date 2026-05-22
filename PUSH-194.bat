@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
git add -A
git commit -m "fix: remove Pexels from UI copy, tech-forward feature lists (push #194)"
git push origin main
pause
