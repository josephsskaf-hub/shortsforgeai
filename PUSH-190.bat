@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
git add -A
git commit -m "fix: FunnelClient truncation + verify all dashboard+pricing changes (push #190)"
git push origin main
pause
