@echo off
REM ============================================================================
REM  KINEO — HOLLYWOOD MODE 2.0 -> PRODUCAO (main)
REM  09/07/2026 (KINEO-HOLLYWOOD-2026-07-09). Autorizado pelo Joseph:
REM  "quero tudo em producao agora" — pula staging, vai direto pra main.
REM  Sobe: roteamento por cena Kling3(dialogo)/Veo3.1(cinematica)/Seedance(apoio)
REM  com AUDIO NATIVO, anti-deepfake (bloqueia pessoa real), TTS por bloco,
REM  custo logado por cena. Preco: 260 creditos, gate Studio.
REM  Seedance/Kling2.5/Veo classicos e Fast Mode ficam 100% intocados.
REM ============================================================================
cd /d "C:\Users\win\Downloads\kineo"
del /f /q ".git\index.lock" 2>nul
git config gc.auto 0

git fetch origin main
git checkout main
git pull --ff-only origin main
if errorlevel 1 (
  echo !!! pull da main falhou - manda o erro acima pro Claude & pause & exit /b 1
)

echo ===== typecheck (gate "error TS" ESCOPADO aos arquivos tocados) =====
call npx tsc --noEmit > kineo_tc.txt 2>&1
REM Arquivos novos/backend: zero tolerancia
findstr /I /C:"error TS" kineo_tc.txt | findstr /I "hollywood generate-video-cinematic cinematic-clip-status compose" > kineo_tc_new.txt
REM GenerateClient: ignora os 8 erros LEGADOS conhecidos (proHasToken/cinematicFeatures/
REM trackCheckoutClick-starter/onClick-MouseEventHandler — pre-existentes, mesmos do
REM gate do AI Avatar de 10/06; prod compila pois next.config ignora type errors)
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
git add "push_hollywood_PROD.bat"
git add "push_hollywood_STAGING.bat"
git status --short
echo n| git -c gc.auto=0 commit -m "HOLLYWOOD MODE 2.0 -> PROD (KINEO-HOLLYWOOD-2026-07-09): per-scene routing Kling3/Veo3.1/Seedance, native audio+lipsync, anti-deepfake, cost logging, 260cr Studio-gated"
echo n| git -c gc.auto=0 push origin main
git log -1 --oneline
echo.
echo ===== PRONTO: Vercel faz deploy da main automaticamente (~2 min). =====
echo Depois do deploy, o Claude valida com um render Hollywood real ao vivo.
pause
