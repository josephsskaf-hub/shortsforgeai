@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
git commit --allow-empty -m "Push #329: re-register Vercel webhook — trigger deploy with #324+#325+#326 fixes"
git push origin main
echo Done! Check https://vercel.com/josephsskaf-hubs-projects/shortsforgeai/deployments
pause
