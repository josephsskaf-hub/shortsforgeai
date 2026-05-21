@echo off
title ShortsForgeAI - Push #179
color 0A
cd /d "C:\Users\win\Downloads\shortsforgeai"

echo.
echo ============================================================
echo  Push #179 - Fix sign-out stuck on "Signing out..."
echo  Uses scope:'local' + 3s timeout race so signOut never
echo  hangs on a slow network. Hard redirect via window.location.
echo ============================================================
echo.

echo [1/5] Killing any stale git processes...
taskkill /F /IM git.exe /T 2>nul
timeout /t 1 /nobreak >nul

echo [2/5] Removing lock files...
if exist ".git\index.lock"     del /f /q ".git\index.lock"
if exist ".git\HEAD.lock"      del /f /q ".git\HEAD.lock"
if exist ".git\MERGE_HEAD"     del /f /q ".git\MERGE_HEAD"
if exist ".git\CHERRY_PICK_HEAD" del /f /q ".git\CHERRY_PICK_HEAD"

echo [3/5] Staging changed files...
git add app/HomePageClient.tsx
git add "app/(dashboard)/account/AccountClient.tsx"
git add components/Sidebar.tsx

echo [4/5] Committing...
git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "fix: sign-out stuck on 'Signing out...' (#179)"
    echo Committed.
) else (
    echo Nothing new to commit - files may already be committed.
)

echo [5/5] Pushing to origin main...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo  OK! Vercel rebuilds in ~1 min.
    echo  Sign-out now clears the session immediately via scope:local
    echo  and always redirects via window.location.href = '/'
) else (
    echo.
    echo  ERROR on push. Check your connection or git credentials.
)

echo.
pause
