@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git add "lib/viralTopics.ts"
git add "app/api/viral-now/route.ts"
git add "app/(dashboard)/viral-now/ViralNowClient.tsx"
git commit -m "Push #337: Viral Now upgrade — 6 rotating cards, 30-topic pool, 4h seed, premium card design"
git push origin main 2>&1
echo.
echo ======= DONE =======
pause
