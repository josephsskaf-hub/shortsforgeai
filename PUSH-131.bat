@echo off
title ShortsForgeAI - Push #131
color 0A
cd /d "%~dp0"

echo.
echo ============================================================
echo  Push 131 - Fix showcase video cards: remove opacity gating
echo  Videos were stuck at opacity:0 because canplay events
echo  dont fire reliably on Google CDN. Now always opacity:1.
echo ============================================================
echo.

if exist ".git\index.lock" (
    del /f /q ".git\index.lock"
)

echo [1/3] Committing...
git add app\HomePageClient.tsx
git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "Push #131 - Fix showcase cards: remove opacity gating so videos render immediately"
    echo Committed.
) else (
    echo Nothing to commit.
)

echo [2/3] Syncing...
git fetch origin
git merge origin/main -X ours --no-edit

echo [3/3] Pushing...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo OK! Vercel vai rebuildar em ~1 min.
    echo Os videos do showcase vao aparecer agora.
) else (
    echo ERRO no push.
)

echo.
pause
