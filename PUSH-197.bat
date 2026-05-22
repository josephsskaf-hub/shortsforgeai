@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
git add -A
git commit -m "fix: welcome email — correct prices ($4.99/$9.90), video generation features, CTA → /generate (push #197)"
git push origin main
pause
