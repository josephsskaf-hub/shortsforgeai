@echo off
title ShortsForgeAI - Push #128+#129
color 0A
cd /d "%~dp0"

echo.
echo ============================================================
echo  Push #128 + #129 - Footage fix + Showcase videos fix
echo ============================================================
echo.

if exist ".git\index.lock" (
    del /f /q ".git\index.lock"
)

:: Commit all pending local changes
echo [1/3] Committing changes...
git add lib\runway.ts
git add lib\pexels.ts
git add app\api\generate-video-fast\route.ts
git add app\HomePageClient.tsx

git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "Push #128+#129 - Fix footage matching + fix showcase videos (replace broken Mixkit URLs with Google CDN)"
    echo Committed.
) else (
    echo Nothing new to commit.
)

:: Sync and push
echo [2/3] Syncing with GitHub...
git fetch origin
git merge origin/main -X ours --no-edit

echo [3/3] Pushing to GitHub...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo  FEITO! Aguarda o Vercel rebuildar (~1 min)
    echo  Os videos do showcase vao aparecer agora!
    echo ============================================================
) else (
    echo ERROR: push falhou.
)

echo.
pause
