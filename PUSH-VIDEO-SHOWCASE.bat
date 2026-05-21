@echo off
echo ============================================
echo  Push #126 — Video showcase + hero video
echo ============================================

REM Remove stale lock file if present
if exist ".git\index.lock" (
  echo Removing stale index.lock...
  del ".git\index.lock"
)

git add -A
git commit -m "Push #126 — Video showcase section + hero video"
git push origin main

echo.
echo Done! Check https://shortsforgeai.com
pause
