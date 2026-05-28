@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
git add app/(dashboard)/dashboard/DashboardClient.tsx
git commit -m "Push #325: Fix Create Video button — /create → /generate (legacy bypass removed)"
git push origin main
echo Done! Check https://vercel.com/josephsskaf-hubs-projects/shortsforgeai/deployments
pause
