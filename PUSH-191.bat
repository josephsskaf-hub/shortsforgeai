@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
git add -A
git commit -m "feat: pricing $4.99/$9.90 + tech-forward copy (push #191)"
git push origin main
pause
