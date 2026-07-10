@echo off
REM ============================================================================
REM  KINEO — HOLLYWOOD 2.2 -> PRODUCAO (main)
REM  10/07/2026 — consolida DUAS rodadas num unico deploy:
REM
REM  KINEO-HOLLYWOOD-21-2026-07-10 (4 fixes do 1o render):
REM   (a) falas preenchem o clipe inteiro — dialogue 5s/10s dimensionado pela fala
REM   (b) legendas nas cenas dialogue = a fala REAL (chunks de ~3 palavras)
REM   (c) Hollywood pula o auto-structure (#310) — planner recebe a ideia CRUA
REM   (d) zero texto legivel na tela (sufixo em codigo + negative_prompt Kling/Veo)
REM
REM  KINEO-HOLLYWOOD-22-2026-07-10 (feedback dos 3 videos reais assistidos):
REM   (e) estrutura viral da casa: HOOK / MICRO REWARD / ESCALATION / PAYOFF
REM       (beat por cena no planner, validado EM CODIGO: cena 1 = HOOK,
REM       ultima = PAYOFF, fallback por posicao)
REM   (f) coerencia visual: styleSheet unico (~30 palavras de fotografia)
REM       anexado em codigo a TODO prompt de cena + support sai do Seedance e
REM       vai pro Kling 3 (mesmo look das dialogue; Veo so 1-2 cenas epicas) +
REM       grade de cor unificado no compose (mascara a troca de motor)
REM   Custo tipico 55s sobe pra ~$8.90 — 260 cr Studio ainda ~64% de margem.
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
echo !!! ERRO DE TYPESCRIPT nos arquivos do Hollywood 2.2 - manda kineo_tc_new.txt pro Claude & type kineo_tc_new.txt & pause & exit /b 1
:tcok
echo Typecheck OK.

REM add EXPLICITO so dos arquivos tocados nas rodadas 2.1 + 2.2 (NUNCA -A)
git add "lib/hollywood/router.ts"
git add "app/api/generate-video-cinematic/route.ts"
git add "app/api/compose/route.ts"
git add "lib/compose.ts"
git add "app/(dashboard)/generate/GenerateClient.tsx"
git add "push_hollywood_v22_PROD.bat"
git status --short
echo n| git -c gc.auto=0 commit -m "HOLLYWOOD 2.2 (KINEO-HOLLYWOOD-21+22-2026-07-10): estrutura viral HOOK/MICRO REWARD/ESCALATION/PAYOFF, coerencia visual (styleSheet + support no Kling3, Seedance out), falas preenchem clipe, legendas = fala real, skip auto-structure, zero texto na tela"
echo n| git -c gc.auto=0 push origin main
git log -1 --oneline
echo.
echo ===== PRONTO: Vercel faz deploy da main automaticamente (~2 min). =====
echo Depois do deploy, avisa o Claude que ele valida com um render Hollywood real.
pause
