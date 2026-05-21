@echo off
echo ============================================================
echo  ShortsForgeAI — Push #125: 3 Engagement Improvements
echo ============================================================
echo.

:: Remove stale index.lock if present
IF EXIST ".git\index.lock" (
    echo Removing stale .git\index.lock...
    DEL /F ".git\index.lock"
    echo Done.
    echo.
)

echo Staging all changes...
git add -A

echo.
echo Committing...
git commit -m "Push #125 — 3 engagement improvements: counter + exit intent + free trial badge"

echo.
echo Pushing to origin/main...
git push origin main

echo.
echo ============================================================
echo  SUCCESS! Push #125 deployed to main.
echo ============================================================
pause
