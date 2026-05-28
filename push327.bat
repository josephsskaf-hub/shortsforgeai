@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
git commit --allow-empty -m "Push #327: trigger Vercel deploy — catch up #324+#325+#326"
git push origin main
echo Done! Check https://vercel.com/josephsskaf-hubs-projects/shortsforgeai/deployments
pause
