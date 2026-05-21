@echo off
title ShortsForgeAI - Push ALL #124 + #125 + #126
color 0A
cd /d "%~dp0"

echo.
echo ============================================================
echo  ShortsForgeAI — PUSH ALL
echo  Push #124: Payment fixes
echo  Push #125: 3 Engagement improvements
echo  Push #126: Video showcase section
echo ============================================================
echo.

:: ─── Remove stale index.lock ────────────────────────────────
if exist ".git\index.lock" (
    echo [LOCK] Removing stale index.lock...
    del /f /q ".git\index.lock"
)

:: ─── Sync with GitHub (handles diverged history) ────────────
echo [1/5] Fetching origin...
git fetch origin
echo [1/5] Merging origin/main (local wins on conflict)...
git merge origin/main -X ours --no-edit
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: merge failed. Run: git status
    pause
    exit /b 1
)

:: ─── Push #124: Payment + checkout fixes ────────────────────
echo.
echo [2/5] Staging Push #124 (payment fixes)...
git add app\checkout\success\page.tsx
git add app\checkout\cancelled\page.tsx
git add app\api\stripe\checkout\route.ts
git add app\api\stripe\portal\route.ts
git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "Push #124 - Fix checkout JSX, restore truncated checkout route, fix www in portal"
    echo Push #124 committed.
) else (
    echo Push #124: nothing new to commit, skipping.
)

:: ─── Push #125: Engagement improvements ─────────────────────
echo.
echo [3/5] Staging Push #125 (engagement improvements)...
git add app\(dashboard)\generate\GenerateClient.tsx 2>nul
git add app\pricing\page.tsx 2>nul
git add app\page.tsx 2>nul
git add app\(marketing)\page.tsx 2>nul
git add components\HomePageClient.tsx 2>nul
git add app\(marketing)\home\HomePageClient.tsx 2>nul
git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "Push #125 - Video counter, exit-intent upgrade modal, free trial banner"
    echo Push #125 committed.
) else (
    echo Push #125: nothing new to commit, skipping.
)

:: ─── Push #126: Video showcase ──────────────────────────────
echo.
echo [4/5] Staging Push #126 (video showcase)...
git add -A
git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "Push #126 - Hero background video + Shorts showcase section (Pexels)"
    echo Push #126 committed.
) else (
    echo Push #126: nothing new to commit, skipping.
)

:: ─── Push everything at once ────────────────────────────────
echo.
echo [5/5] Pushing all commits to GitHub...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo  TUDO ENVIADO! Vercel vai rebuildar automaticamente.
    echo  Confere em: https://vercel.com/dashboard
    echo ============================================================
) else (
    echo.
    echo ERROR: push falhou. Verifique o output acima.
)

echo.
pause
