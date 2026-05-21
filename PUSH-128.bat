@echo off
title ShortsForgeAI - Push #128 Fix footage matching
color 0A
cd /d "%~dp0"

echo.
echo ============================================================
echo  Push #128 - Fix: footage ALWAYS matches the video topic
echo  Pyramid script = pyramid footage (not photographer!)
echo ============================================================
echo.

:: Remove stale index.lock
if exist ".git\index.lock" (
    echo [LOCK] Removing stale index.lock...
    del /f /q ".git\index.lock"
)

:: Step 1 — Commit local changes FIRST before syncing
echo [1/3] Committing local changes...
git add lib\runway.ts
git add lib\pexels.ts
git add app\api\generate-video-fast\route.ts

git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "Push #128 - Fix footage mismatch: GPT returns topic-specific Pexels keywords separate from Runway cinematic descriptions"
    echo Push #128 committed.
) else (
    echo Nothing new to commit (already committed).
)

:: Step 2 — Sync with GitHub (merge remote into local, local wins on conflict)
echo [2/3] Syncing with GitHub...
git fetch origin
git merge origin/main -X ours --no-edit
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: merge failed. Run: git status
    pause
    exit /b 1
)

:: Step 3 — Push
echo [3/3] Pushing to GitHub...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo  ENVIADO! Vercel vai rebuildar.
    echo  Teste: gera um video sobre "piramides do egito"
    echo  O footage agora vai mostrar piramides, nao fotografo!
    echo ============================================================
) else (
    echo ERROR: push falhou. Verifique o output acima.
)

echo.
pause
