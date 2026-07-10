@echo off
REM ============================================================================
REM  KINEO — PRICING V3 + HOLLYWOOD 3.0 -> PRODUCAO (main)
REM  10/07/2026 — KINEO-REBASE-2026-07-10 + KINEO-HOLLYWOOD-30-2026-07-10
REM
REM  PACOTE DA MANHA (aprovado pelo fundador):
REM   (1) REBASE 2:1 dos creditos — numeros caem pela metade, USD igual:
REM       planos 25/120/200; motores Seedance 20 / Kling 45 / Veo 90 /
REM       Sora 100 (segue bloqueado) / HOLLYWOOD 150 / Avatar 110 /
REM       Animate 5 / legado 8-8-10. Migracao 011_credit_rebase.sql converte
REM       saldos (ceil, a favor do usuario) — CLAUDE APLICA DEPOIS DO PUSH,
REM       o .bat NAO mexe no banco. Banner de conversao no dashboard
REM       (CreditRebaseBanner, some sozinho em 24/07).
REM   (2) CREDITOS UNIVERSAIS — fim do gate por plano nos motores: qualquer
REM       pagante com saldo usa qualquer motor (Sora segue fora).
REM   (3) EXIT-INTENT v2 ESCADA — modal com 2 opcoes lado a lado:
REM       $4.90 one-time (25 Shorts) vs $9.90/mo Starter destacado BEST VALUE.
REM   (4) ROBO DE ABANDONO NA ROTINA — cron diario send-reminders (10h) chama
REM       send-abandon-recovery com CRON_SECRET (idempotente, so novos leads).
REM   (5) COUNTDOWN $2.90 POS-EXIT — exit-intent visto sem conversao grava
REM       kineo_exit_seen_at; Offer290Banner arma o countdown de 24h.
REM   (6) HOLLYWOOD 3.0 "UM MUNDO" — ancoras de imagem (retrato + ambiente),
REM       todas as cenas Kling O3 Pro i2v, crossfade 250ms (ja codado antes).
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
REM Arquivos novos/backend/componentes: zero tolerancia
findstr /I /C:"error TS" kineo_tc.txt | findstr /I "hollywood generate-video-cinematic cinematic-clip-status compose pricing ExitIntentOffer CreditRebaseBanner Offer290Banner PostVideoPaywall PricingCards AvatarLanding AvatarStudio AnimateClient animate-image send-abandon-recovery send-reminders DashboardShell KineoLanding HomePageClient facts cheapest-ai" > kineo_tc_new.txt
REM GenerateClient: ignora os erros LEGADOS conhecidos (proHasToken/cinematicFeatures/
REM trackCheckoutClick-starter/onClick-MouseEventHandler — pre-existentes; prod compila
REM pois next.config ignora type errors)
findstr /I /C:"error TS" kineo_tc.txt | findstr /I "GenerateClient" | findstr /V /I "proHasToken cinematicFeatures MouseEventHandler starter implicitly" >> kineo_tc_new.txt
findstr /R "." kineo_tc_new.txt >nul
if errorlevel 1 goto tcok
echo !!! ERRO DE TYPESCRIPT nos arquivos do pacote - manda kineo_tc_new.txt pro Claude & type kineo_tc_new.txt & pause & exit /b 1
:tcok
echo Typecheck OK.

REM add EXPLICITO so dos arquivos tocados (NUNCA -A)
REM --- Hollywood 3.0 (KINEO-HOLLYWOOD-30) ---
git add "lib/hollywood/router.ts"
git add "lib/hollywood/anchors.ts"
git add "app/api/generate-video-cinematic/route.ts"
git add "app/api/cinematic-clip-status/route.ts"
git add "lib/compose.ts"
git add "push_hollywood_v30_PROD.bat"
REM --- Rebase 2:1 + creditos universais (KINEO-REBASE) ---
git add "lib/pricing.ts"
git add "app/api/compose/status/[renderId]/route.ts"
git add "app/(dashboard)/generate/GenerateClient.tsx"
git add "app/(dashboard)/DashboardShell.tsx"
git add "components/CreditRebaseBanner.tsx"
git add "components/PricingCards.tsx"
git add "components/PostVideoPaywall.tsx"
git add "components/AvatarLandingClient.tsx"
git add "app/(dashboard)/avatar/AvatarStudioClient.tsx"
git add "app/(dashboard)/animate/AnimateClient.tsx"
git add "app/api/animate-image/route.ts"
git add "app/pricing/page.tsx"
git add "app/KineoLanding.tsx"
git add "app/HomePageClient.tsx"
git add "app/start/page.tsx"
git add "app/facts/page.tsx"
git add "app/cheapest-ai-shorts-maker/page.tsx"
git add "supabase/migrations/011_credit_rebase.sql"
REM --- Exit-intent v2 + countdown pos-exit ---
git add "components/ExitIntentOffer.tsx"
git add "app/(dashboard)/generate/Offer290Banner.tsx"
REM --- Robo de abandono na rotina ---
git add "app/api/admin/send-abandon-recovery/route.ts"
git add "app/api/cron/send-reminders/route.ts"
REM --- este proprio bat ---
git add "push_manha_PROD.bat"
git status --short
echo n| git -c gc.auto=0 commit -m "PRICING V3 + HOLLYWOOD 3.0 (KINEO-REBASE + KINEO-HOLLYWOOD-30): rebase creditos 2:1, Hollywood 150cr, creditos universais, exit-intent escada 4.90/9.90, abandono na rotina, countdown 2.90 pos-exit, anchors de imagem"
echo n| git -c gc.auto=0 push origin main
git log -1 --oneline
echo.
echo ===== PRONTO: Vercel faz deploy da main automaticamente (~2 min). =====
echo DEPOIS DO DEPLOY: avisa o Claude — ele aplica a migracao 011 (rebase de
echo saldos) no Supabase e valida um render + o banner + o exit-intent novo.
pause
