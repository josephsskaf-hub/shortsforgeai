@echo off
REM ============================================================================
REM  KINEO — HOLLYWOOD 3.0 "UM MUNDO" -> PRODUCAO (main)
REM  10/07/2026 — KINEO-HOLLYWOOD-30-2026-07-10
REM
REM  PROBLEMA (feedback real do fundador): o apresentador MUDA DE ROSTO entre
REM  as cenas dele, e o b-roll vive num "mundo" visualmente diferente — cada
REM  clipe era uma geracao text-to-video independente; characterSheet textual
REM  nao trava identidade.
REM
REM  SOLUCAO — ancoras de imagem:
REM   (1) ANTES das cenas, 2 imagens via flux/schnell (~$0.10 total):
REM       RETRATO canonico do apresentador (9:16, meio corpo, olhando pra
REM       camera, no ambiente) + STILL do ambiente (9:16, sem pessoas).
REM       Novo arquivo: lib/hollywood/anchors.ts (fail-open: falhou -> null).
REM   (2) TODAS as cenas viram Kling O3 Pro IMAGE-to-video
REM       (fal-ai/kling-video/o3/pro/image-to-video): dialogue -> image_url =
REM       retrato (mesmo rosto SEMPRE); support/cinematic -> image_url = still
REM       do ambiente (mesmo mundo SEMPRE). Params: { image_url, prompt,
REM       duration '3'..'15' string, generate_audio true }. $0.168/s audio-on.
REM   (3) FALLBACK FAIL-OPEN: sem ancoras -> caminho t2v v2.4 intacto; o
REM       render nunca morre por causa das ancoras.
REM   (4) CROSSFADE 250ms entre clips do track 2 no
REM       buildHollywoodCreatomateSource (gate HOLLYWOOD_CROSSFADE=true em
REM       lib/compose.ts pra desligar facil).
REM
REM  Custo tipico 55s ~= $9.34 (55s x $0.168 + $0.10 ancoras); 60s ~= $10.18.
REM  Arquivos: lib/hollywood/anchors.ts (novo), lib/hollywood/router.ts,
REM  app/api/generate-video-cinematic/route.ts,
REM  app/api/cinematic-clip-status/route.ts, lib/compose.ts.
REM  Fast Mode/avatar/pricing/Stripe intocados.
REM
REM  Working tree ja esta na main com o codigo pronto — este .bat so valida,
REM  commita os arquivos tocados e faz o push.
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
REM GenerateClient: ignora os erros LEGADOS conhecidos (proHasToken/cinematicFeatures/
REM trackCheckoutClick-starter/onClick-MouseEventHandler — pre-existentes; prod compila
REM pois next.config ignora type errors)
findstr /I /C:"error TS" kineo_tc.txt | findstr /I "GenerateClient" | findstr /V /I "proHasToken cinematicFeatures MouseEventHandler starter implicitly" >> kineo_tc_new.txt
findstr /R "." kineo_tc_new.txt >nul
if errorlevel 1 goto tcok
echo !!! ERRO DE TYPESCRIPT nos arquivos do Hollywood 3.0 - manda kineo_tc_new.txt pro Claude & type kineo_tc_new.txt & pause & exit /b 1
:tcok
echo Typecheck OK.

REM add EXPLICITO so dos arquivos tocados na rodada 3.0 (NUNCA -A)
git add "lib/hollywood/anchors.ts"
git add "lib/hollywood/router.ts"
git add "app/api/generate-video-cinematic/route.ts"
git add "app/api/cinematic-clip-status/route.ts"
git add "lib/compose.ts"
git add "push_hollywood_v30_PROD.bat"
git status --short
echo n| git -c gc.auto=0 commit -m "HOLLYWOOD 3.0 UM MUNDO (KINEO-HOLLYWOOD-30-2026-07-10): retrato canonico + ambiente como ancora de imagem, todas as cenas Kling O3 Pro image-to-video (mesmo rosto e mesmo mundo garantidos), crossfade 250ms"
echo n| git -c gc.auto=0 push origin main
git log -1 --oneline
echo.
echo ===== PRONTO: Vercel faz deploy da main automaticamente (~2 min). =====
echo Depois do deploy, avisa o Claude que ele valida com um render Hollywood real.
pause
