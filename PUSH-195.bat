@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
git add -A
git commit -m "feat: /start LP refresh — benefits section, stronger hero, FAQ+1, second CTA (push #195)"
git push origin main
pause
