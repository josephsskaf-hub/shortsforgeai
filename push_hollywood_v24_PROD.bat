@echo off
REM ============================================================================
REM  KINEO — HOLLYWOOD 2.4 -> PRODUCAO (main)
REM  10/07/2026 — KINEO-HOLLYWOOD-24-2026-07-10 (round 4: nota ~8.5, sobrou 1
REM  defeito: cena support de 10s com b-roll de grafico SEM narracao audivel —
REM  o mp3 do BLOCO saiu mais curto que o bloco e a sobra virou silencio na
REM  ultima cena support):
REM
REM   (i) TTS POR CENA — compose agora gera UM mp3 POR CENA narrada (nao mais
REM       por bloco contiguo), posicionado no inicio DAQUELA cena e com corte
REM       duro no fim da propria cena + 0.5s (endCap novo no
REM       HollywoodNarrationBlock, aplicado no buildHollywoodCreatomateSource).
REM       Silencio residual so pode ser a cauda da PROPRIA cena (<=2-3s),
REM       nunca 10s acumulados. Whisper/legendas seguem o mp3 da cena.
REM       Fallback mantido: TTS de uma cena falhou -> so ELA degrada pra
REM       audio nativo, render nunca morre. Custo: ~2-4 chamadas TTS, ok.
REM   (ii) SUPPORT DIMENSIONADA PELA NARRACAO — router: support com voiceover
REM       FINAL (pos-fallback v2.3) <16 palavras -> 5s; >=16 -> 10s (Kling so
REM       renderiza 5/10; cinematic segue fixa em 8s/Veo). O clipe nunca dura
REM       mais que as palavras dele.
REM   (iii) MAX 1 B-ROLL LONGO SEGUIDO — system prompt + codigo: duas cenas
REM       nao-dialogue adjacentes nunca ficam AMBAS com 10s; a segunda cai pra
REM       5s e a narracao dela e recortada (~12 palavras, frases completas
REM       quando possivel). Parede de b-roll >10s mata retencao.
REM
REM  Arquivos: lib/hollywood/router.ts, app/api/compose/route.ts,
REM  lib/compose.ts. Fast Mode/avatar/pricing/Stripe intocados.
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
echo !!! ERRO DE TYPESCRIPT nos arquivos do Hollywood 2.4 - manda kineo_tc_new.txt pro Claude & type kineo_tc_new.txt & pause & exit /b 1
:tcok
echo Typecheck OK.

REM add EXPLICITO so dos arquivos tocados na rodada 2.4 (NUNCA -A)
git add "lib/hollywood/router.ts"
git add "app/api/compose/route.ts"
git add "lib/compose.ts"
git add "push_hollywood_v24_PROD.bat"
git status --short
echo n| git -c gc.auto=0 commit -m "HOLLYWOOD 2.4 (KINEO-HOLLYWOOD-24-2026-07-10): TTS por cena (mata silencio residual de bloco), support dimensionada pela narracao, max 1 b-roll longo consecutivo"
echo n| git -c gc.auto=0 push origin main
git log -1 --oneline
echo.
echo ===== PRONTO: Vercel faz deploy da main automaticamente (~2 min). =====
echo Depois do deploy, avisa o Claude que ele valida com um render Hollywood real.
pause
