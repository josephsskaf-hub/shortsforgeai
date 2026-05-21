@echo off
title ShortsForgeAI - Push #132 video fix
color 0A
cd /d "%~dp0"

echo.
echo ============================================================
echo  Push #132 - Fix showcase videos: Pexels dynamic fetch
echo  Google CDN bucket went private (403). Videos now fetched
echo  server-side from Pexels via /api/showcase-clips.
echo ============================================================
echo.

if exist ".git\index.lock" (
    del /f /q ".git\index.lock"
)

echo [1/3] Committing...
git add app\HomePageClient.tsx
git add app\api\showcase-clips\route.ts
git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "Push #132 - Fix showcase videos: replace dead Google CDN with Pexels dynamic fetch via /api/showcase-clips"
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
    echo Os cards vao mostrar videos reais do Pexels agora.
) else (
    echo ERRO no push.
)

echo.
pause
