@echo off
cd /d C:\Users\win\Downloads\shortsforgeai

echo [Push #324] Removing index.lock if present...
if exist .git\index.lock del /f .git\index.lock

echo [Push #324] Fetching remote state...
git fetch origin

echo [Push #324] Syncing local to remote HEAD (all 5 browser commits already on GitHub)...
git reset --hard origin/main

echo [Push #324] Creating deploy trigger commit...
git commit --allow-empty -m "Push #324: Viral Now 6 niches + 5h rotation (vercel.json + cron + viral-now API + ViralNowClient + DashboardClient)"

echo [Push #324] Pushing to GitHub (triggers Vercel deploy)...
git push origin main

echo.
echo Done! Check https://vercel.com/josephsskaf-hubs-projects/shortsforgeai/deployments
pause
