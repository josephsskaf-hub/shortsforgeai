@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
git add -A
git commit -m "fix: BRL prices R$24.90/R$49.90 + tech-forward modal copy (push #193)"
git push origin main
pause
