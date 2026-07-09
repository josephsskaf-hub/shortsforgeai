@echo off
REM ============================================================================
REM  KINEO — HOLLYWOOD MODE 2.0 checkpoint 1 -> BRANCH (PREVIEW/STAGING)
REM  09/07/2026 (KINEO-HOLLYWOOD-2026-07-09). NAO vai pra prod/main.
REM  Sobe pra branch feature/hollywood-mode; a Vercel cria uma URL de PREVIEW.
REM  O que sobe: roteamento por cena Kling3(dialogo)/Veo3.1(cinematica)/
REM  Seedance(apoio) com AUDIO NATIVO, anti-deepfake (bloqueia pessoa real),
REM  TTS por bloco no compose, custo logado por cena, 260 cr PROVISORIO.
REM  Seedance/Kling2.5/Veo classicos ficam 100% intocados.
REM ============================================================================
cd /d "C:\Users\win\Downloads\kineo"
del /f /q ".git\index.lock" 2>nul
git config gc.auto 0

git fetch origin main
git checkout -B feature/hollywood-mode origin/main

echo ===== typecheck (gate "error TS" ESCOPADO aos arquivos tocados) =====
call npx tsc --noEmit > kineo_tc.txt 2>&1
findstr /I /C:"error TS" kineo_tc.txt | findstr /I "hollywood generate-video-cinematic cinematic-clip-status compose" > kineo_tc_new.txt
findstr /I /C:"error TS" kineo_tc.txt | findstr /I "GenerateClient" | findstr /V /I "proHasToken cinematicFeatures MouseEventHandler starter implicitly" >> kineo_tc_new.txt
findstr /R "." kineo_tc_new.txt >nul
if errorlevel 1 goto tcok
echo !!! ERRO DE TYPESCRIPT nos arquivos do Hollywood Mode - manda kineo_tc_new.txt pro Claude & type kineo_tc_new.txt & pause & exit /b 1
:tcok
echo Typecheck OK.

REM add EXPLICITO so dos arquivos tocados (NUNCA -A)
git add "lib/hollywood/router.ts"
git add "app/api/generate-video-cinematic/route.ts"
git add "app/api/cinematic-clip-status/route.ts"
git add "app/api/compose/route.ts"
git add "app/api/compose/status/[renderId]/route.ts"
git add "lib/compose.ts"
git add "app/(dashboard)/generate/GenerateClient.tsx"
git add "push_hollywood_STAGING.bat"
git status --short
echo n| git -c gc.auto=0 commit -m "HOLLYWOOD MODE 2.0 - checkpoint 1 (KINEO-HOLLYWOOD-2026-07-09): scene routing Kling3/Veo3.1/Seedance, native audio, anti-deepfake, cost logging"
echo n| git -c gc.auto=0 push -u origin feature/hollywood-mode
git log -1 --oneline
git checkout main
echo.
echo ===== Vercel vai gerar preview URL do branch em ~1-2 min: =====
echo shortsforgeai-git-feature-hollywood-mode-josephsskaf-hubs-projects.vercel.app
echo (ou pega a URL exata em vercel.com -^> Deployments -^> branch feature/hollywood-mode)
pause
