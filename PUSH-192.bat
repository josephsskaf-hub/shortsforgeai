@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
git add -A
git commit -m "feat: update prices $4.99/$9.90 — dashboard, mobile, stripe backend (push #192)"
git push origin main
pause
