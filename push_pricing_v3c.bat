@echo off
REM ============================================================================
REM  KINEO — PRICING V3B + V3C -> PRODUCAO (main)
REM  10/07/2026 — KINEO-PRICING-V3B-2026-07-10 + KINEO-PRICING-V3C-2026-07-10
REM  (SUBSTITUI o push_pricing_v3b.bat — inclui todos os arquivos dele + V3C)
REM
REM  V3B (ja codado, nunca deployado):
REM   (1) CREATOR: $19.90/120cr -> $24.90/mes com 150 creditos
REM       ("1 Hollywood film every month included"). Webhook credita 150 no
REM       start E na renovacao; PayPal espelhado. Assinantes existentes
REM       NAO sao afetados. pro/starter alinhados ao rebase 2:1 (200/25).
REM   (2) KLING: 45 -> 50 creditos (custo + badges/FAQ/facts).
REM   (3) Superficies de UI: pricing page, PricingCards, KineoLanding,
REM       GenerateClient, start, facts, founding, checkout/cancelled,
REM       e-mails welcome + reminders, generate 402, geo.
REM
REM  V3C (esta rodada):
REM   (4) FAST = 1 CREDITO POR VIDEO PARA PAGANTES (has_paid ou plano pago).
REM       Free continua 0 (watermark + paywall de download — funil
REM       KINEO-ZERO-SIGNUP intacto). Debito idempotente por render_id via
REM       debit_video_credits. Pagante com saldo 0: render NUNCA quebra —
REM       entrega limpa sem debito, log [fast-credit] skip (fail-open).
REM       UI: badge do card Fast vira "1 credit" p/ pagante; rodape de custo
REM       e botao Generate mostram "1 credit".
REM   (5) PACK $4.90: 25 -> 10 creditos (Stripe metadata pack_credits,
REM       fallback legado 490->10 no webhook, PayPal espelhado) + toda a
REM       copy "25 Shorts" -> "10 videos" (paywall, exit-intent, pricing,
REM       landing, facts, unlock cards My Videos/History, e-mail win-back,
REM       mensagem 402 do limite diario). Oferta $2.90 ja era 10 (confere).
REM       Os 25 CREDITOS/mes do plano Starter $9.90 NAO mudam.
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
REM Arquivos do pacote V3B+V3C: zero tolerancia
REM Caminhos ESPECIFICOS ("start"/"checkout" soltos pescavam erros legados de
REM checkout/success (gtag) e o texto 'starter' dos erros do GenerateClient)
findstr /I /C:"error TS" kineo_tc.txt | findstr /I "pricing.ts paypal.ts webhook stripe/checkout generate-video-cinematic compose PricingCards KineoLanding founding cancelled send-welcome send-reminders send-pack-offer facts app/start geo ExitIntentOffer PostVideoPaywall MyVideosClient HistoryClient" | findstr /V /I "gtag starter" > kineo_tc_new.txt
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
REM --- Core de pricing/creditos (V3B) ---
git add "lib/pricing.ts"
git add "lib/paypal.ts"
git add "app/api/stripe/checkout/route.ts"
git add "app/api/stripe/webhook/route.ts"
REM --- Kling 50 cr + Fast 1cr pagante (custo real de cobranca) ---
git add "app/api/generate-video-cinematic/route.ts"
git add "app/api/compose/status/[renderId]/route.ts"
REM --- V3C: mensagem 402 do limite free (copy 10 videos) ---
git add "app/api/compose/route.ts"
REM --- Superficies de UI ---
git add "app/(dashboard)/generate/GenerateClient.tsx"
git add "components/PricingCards.tsx"
git add "app/pricing/page.tsx"
git add "app/KineoLanding.tsx"
git add "app/start/page.tsx"
git add "app/facts/page.tsx"
git add "app/founding/page.tsx"
git add "app/checkout/cancelled/page.tsx"
REM --- V3C: copy do pack 25->10 videos ---
git add "components/ExitIntentOffer.tsx"
git add "components/PostVideoPaywall.tsx"
git add "app/(dashboard)/my-videos/MyVideosClient.tsx"
git add "app/(dashboard)/history/HistoryClient.tsx"
REM --- E-mails / mensagens de API ---
git add "app/api/send-welcome/route.ts"
git add "app/api/cron/send-reminders/route.ts"
git add "app/api/admin/send-pack-offer/route.ts"
git add "app/api/generate/route.ts"
git add "app/api/geo/route.ts"
REM --- os proprios bats (v3c novo + v3b virou stub) ---
git add "push_pricing_v3c.bat"
git add "push_pricing_v3b.bat"
git status --short
echo n| git -c gc.auto=0 commit -m "PRICING V3B+V3C: Creator 24.90/150cr, Kling 50cr, webhook rebase fix 200/25, Fast 1cr para pagantes, pack 4.90 = 10 creditos"
echo n| git -c gc.auto=0 push origin main
git log -1 --oneline
echo.
echo ===== PRONTO: Vercel faz deploy da main automaticamente (~2 min). =====
echo DEPOIS DO DEPLOY: avisa o Claude — ele valida a pricing page ($24.90/150cr,
echo pack "10 videos"), o badge do Kling (50 cr), o badge "1 credit" do Fast em
echo conta pagante e um render Fast pagante (debito de 1 credito no saldo).
pause
