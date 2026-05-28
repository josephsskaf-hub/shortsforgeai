@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
git add app/(dashboard)/history/HistoryClient.tsx
git commit -m "Push #326: Fix My Videos titles — strip [Pexels: ...] tags from fallback extractTitle"
git push origin main
echo Done! Check https://vercel.com/josephsskaf-hubs-projects/shortsforgeai/deployments
pause
