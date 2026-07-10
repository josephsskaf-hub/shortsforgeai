@echo off
REM ============================================================================
REM  KINEO — HOLLYWOOD 2.3 -> PRODUCAO (main)
REM  10/07/2026 — KINEO-HOLLYWOOD-23-2026-07-10 (round 3: nota 2 -> 8, sobraram
REM  2 defeitos, ambos em cenas support/Kling 3 sem fala embutida):
REM
REM   (g) ZERO SEGUNDOS MUDOS — TODA cena nao-dialogue (support/cinematic) tem
REM       narracao OBRIGATORIA: exigida no system prompt (~2.3 palavras/s,
REM       emendando na fala anterior) E garantida EM CODIGO com fallback
REM       deterministico (frase nao usada do roteiro original ou caption
REM       expandido por beat — nunca null); needsNarration=true SEMPRE em
REM       nao-dialogue -> compose sempre emite o bloco TTS.
REM   (h) COMPOSICAO ESTAVEL — sufixo em codigo nos prompts support/cinematic:
REM       "Level horizon, stable well-composed shot (tripod or slow dolly),
REM       no tilted or dutch angles." (a cena final de Manhattan saiu torta).
REM
REM   Compose NAO foi tocado: o cap do mp3 de narracao antes da proxima cena
REM   dialogue JA EXISTE em buildHollywoodCreatomateSource (hardEnd/audioDur).
REM
REM  Working tree ja esta na main com o codigo pronto — este .bat so valida,
REM  commita os arquivos tocados e faz o push. Fast Mode/avatar/pricing intocados.
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
echo !!! ERRO DE TYPESCRIPT nos arquivos do Hollywood 2.3 - manda kineo_tc_new.txt pro Claude & type kineo_tc_new.txt & pause & exit /b 1
:tcok
echo Typecheck OK.

REM add EXPLICITO so dos arquivos tocados na rodada 2.3 (NUNCA -A)
git add "lib/hollywood/router.ts"
git add "push_hollywood_v23_PROD.bat"
git status --short
echo n| git -c gc.auto=0 commit -m "HOLLYWOOD 2.3 (KINEO-HOLLYWOOD-23-2026-07-10): narração obrigatória em toda cena de apoio (zero segundos mudos) + composição estável sem dutch angle"
echo n| git -c gc.auto=0 push origin main
git log -1 --oneline
echo.
echo ===== PRONTO: Vercel faz deploy da main automaticamente (~2 min). =====
echo Depois do deploy, avisa o Claude que ele valida com um render Hollywood real.
pause
