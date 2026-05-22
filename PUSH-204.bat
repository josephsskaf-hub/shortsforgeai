@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: change Basic price from $4.99 to $4.90 across all UI + Stripe checkout (push #204)"
git push origin main
pause
