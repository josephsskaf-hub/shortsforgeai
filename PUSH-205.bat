@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "chore: update Basic Stripe payment link to $4.90 (push #205)"
git push origin main
pause
