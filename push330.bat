@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
git add CLAUDE.md
git commit -m "Push #330: CLAUDE.md v2.8 — bump version to confirm webhook working"
git push origin main
echo Done! Check https://vercel.com/josephsskaf-hubs-projects/shortsforgeai/deployments
pause
