@echo off
echo ============================================================
echo   ShortsForgeAI — Deploy Upgrade to Vercel
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking Git status...
git status

echo.
echo [2/4] Adding all changes...
git add -A

echo.
echo [3/4] Committing upgrade...
git commit -m "feat: complete upgrade — home page, auth fix, templates, account, forgot-password, sidebar v2, real-time sync"

echo.
echo [4/4] Pushing to remote (Vercel auto-deploys)...
git push

echo.
echo ============================================================
echo   Done! Vercel will auto-deploy in ~1-2 minutes.
echo   Check: https://vercel.com/dashboard
echo ============================================================
echo.
pause
