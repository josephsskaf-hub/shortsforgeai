@echo off
cd /d "%~dp0"
echo ============================================================
echo  Push #124 -- Fix broken JSX + checkout route truncation
echo ============================================================

:: Remove stale lock if present
if exist ".git\index.lock" (
    echo Removing stale index.lock...
    del /f ".git\index.lock"
)

:: Sync with remote, prefer local on conflict
echo Fetching origin...
git fetch origin
echo Merging origin/main (ours wins on conflict)...
git merge origin/main -X ours --no-edit

:: Stage all fixed files
git add app\checkout\success\page.tsx
git add app\checkout\cancelled\page.tsx
git add app\api\stripe\checkout\route.ts
git add app\api\stripe\portal\route.ts

:: Commit
git commit -m "Push #124 - Fix broken JSX in checkout pages + restore truncated checkout route + fix www in portal"

:: Push
echo Pushing to origin/main...
git push origin main

echo.
echo ============================================================
echo  Done! Check Vercel dashboard for build status.
echo ============================================================
pause
