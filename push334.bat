@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
if exist .git\HEAD.lock del /f .git\HEAD.lock
git add "app/(dashboard)/generate/GenerateClient.tsx"
git commit -m "Push #334: fix GenerateClient.tsx truncation — restore missing </ol> + closing braces at end of GenerationProgressSteps"
git push origin main 2>&1
echo.
echo ======= DONE =======
pause
