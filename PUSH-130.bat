@echo off
title ShortsForgeAI - Push #130
color 0A
cd /d "%~dp0"

echo.
echo ============================================================
echo  Push 130 - Fix site crash: videoCounter is not defined
echo ============================================================
echo.

if exist ".git\index.lock" (
    del /f /q ".git\index.lock"
)

echo [1/3] Committing fix...
git add app\HomePageClient.tsx
git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "Push #130 - Fix ReferenceError: videoCounter is not defined (use shortsTotal)"
    echo Committed.
) else (
    echo Nothing to commit.
)

echo [2/3] Syncing with GitHub...
git fetch origin
git merge origin/main -X ours --no-edit

echo [3/3] Pushing...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo OK! Site vai voltar ao ar em ~1 min no Vercel.
) else (
    echo ERROR: push falhou.
)

echo.
pause
