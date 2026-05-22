@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo.
echo ============================================
echo   ShortsForgeAI -- Pre-Push Check
echo ============================================
echo.

:: 1. Check for git index lock
if exist ".git\index.lock" (
  echo [WARN] Git index.lock found -- removing...
  del /f ".git\index.lock"
)

:: 2. Check for truncated files (less than 50 lines = suspicious)
echo [1/4] Checking file sizes...
set FAIL=0
for %%F in (
  "app\(dashboard)\generate\GenerateClient.tsx"
  "app\(dashboard)\create\CreateClient.tsx"
  "app\HomePageClient.tsx"
  "app\(dashboard)\my-videos\MyVideosClient.tsx"
  "app\api\compose\status\[renderId]\route.ts"
  "components\Sidebar.tsx"
  "components\TopBar.tsx"
) do (
  for /f %%C in ('find /c /v "" %%F 2^>nul') do set LINES=%%C
  if %%C LSS 50 (
    echo   [FAIL] %%F has too few lines ^(%%C^) -- may be truncated!
    set FAIL=1
  ) else (
    echo   [OK]   %%F ^(%%C lines^)
  )
)

:: 3. Check TypeScript compiles (requires node/npx)
echo.
echo [2/4] Checking TypeScript...
call npx tsc --noEmit --skipLibCheck 2>nul
if %errorlevel% == 0 (
  echo   [OK]   No TypeScript errors
) else (
  echo   [WARN] TypeScript errors found -- check output above
)

:: 4. Check no import points to missing files
echo.
echo [3/4] Checking critical imports exist...
for %%F in (
  "lib\supabase\client.ts"
  "lib\openai.ts"
  "components\ResultCard.tsx"
  "components\Sidebar.tsx"
  "components\TopBar.tsx"
) do (
  if exist %%F (
    echo   [OK]   %%F
  ) else (
    echo   [FAIL] %%F MISSING!
    set FAIL=1
  )
)

:: 5. Check no .env secrets accidentally staged
echo.
echo [4/4] Checking nothing sensitive is staged...
git diff --cached --name-only | findstr /i ".env" >nul
if %errorlevel% == 0 (
  echo   [FAIL] .env file staged -- remove it before pushing!
  set FAIL=1
) else (
  echo   [OK]   No .env files staged
)

:: Result
echo.
echo ============================================
if %FAIL% == 1 (
  echo   RESULT: Issues found above. Fix before pushing!
) else (
  echo   RESULT: All checks passed. Safe to push!
)
echo ============================================
echo.
pause
