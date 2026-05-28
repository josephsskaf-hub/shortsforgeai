@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git add "app/api/viral-now/route.ts"
git commit -m "Push #336: fix Viral Now crash — remove double comma creating undefined hole in FALLBACK_TOPICS array"
git push origin main 2>&1
echo.
echo ======= DONE =======
pause
