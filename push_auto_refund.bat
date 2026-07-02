@echo off
REM ============================================================
REM AUTO-REFUND de creditos quando a geracao de video FALHA
REM (feedback da reviewer do TAAFT — antes: pedir refund no suporte)
REM
REM O que sobe:
REM  - lib/credits/refund.ts                      (novo: refund + sweep, service-role)
REM  - app/api/compose/status/[renderId]/route.ts (failed => refund idempotente + msg)
REM  - app/api/animate-image/route.ts             (debit keyed animate-<falRequestId>)
REM  - app/api/avatar-status/route.ts             (animate failed => auto-refund)
REM  - app/api/render/route.ts                    (debit via RPC, key legacy-<renderId>)
REM  - app/api/render/[id]/route.ts               (failed => auto-refund legacy)
REM  - app/api/cron/send-reminders/route.ts       (sweep diario de debitos presos >2h)
REM  - app/(dashboard)/generate/GenerateClient.tsx (msg de falha menciona refund)
REM
REM Migracoes JA APLICADAS em prod via MCP (auto_refund_failed_renders +
REM lock_add_video_credits_to_service_role) — nada de SQL manual aqui.
REM ============================================================
cd /d C:\Users\win\Downloads\kineo

echo [1/3] Typecheck gate (erros TS1xxx escopados aos arquivos tocados)...
call npx tsc --noEmit --incremental false > autorefund_typecheck.txt 2>&1
findstr /I /C:"credits/refund" /C:"animate-image" /C:"avatar-status" /C:"compose/status" /C:"send-reminders" /C:"api/render" /C:"GenerateClient" autorefund_typecheck.txt | findstr /R /C:"error TS1[0-9][0-9][0-9]" > autorefund_gate.txt
if not errorlevel 1 (
  echo.
  echo ============ GATE FALHOU — erros TS1 nos arquivos tocados: ============
  type autorefund_gate.txt
  echo =======================================================================
  pause
  exit /b 1
)
echo Gate OK — nenhum erro TS1 nos arquivos tocados.

echo [2/3] git add (explicito) + commit...
git add lib/credits/refund.ts
git add "app/api/compose/status/[renderId]/route.ts"
git add app/api/animate-image/route.ts
git add app/api/avatar-status/route.ts
git add app/api/render/route.ts
git add "app/api/render/[id]/route.ts"
git add app/api/cron/send-reminders/route.ts
git add "app/(dashboard)/generate/GenerateClient.tsx"
git add push_auto_refund.bat
git commit -m "Auto-refund credits on failed renders (TAAFT feedback): idempotent refund_render_credits RPC (claims credit_debits row WHERE refunded_at IS NULL), live refunds in compose/status + avatar-status + render/[id], animate debit re-keyed to animate-<falRequestId>, legacy render debit moved to atomic ledger RPC (legacy-<renderId>), daily stuck-debit sweep piggybacked on send-reminders cron, failure UI now says credits were refunded"
if errorlevel 1 (
  echo Commit falhou (nada pra commitar?) — abortando push.
  pause
  exit /b 1
)

echo [3/3] git push...
git push origin main
if errorlevel 1 (
  echo PUSH FALHOU — verifique rede/credenciais e rode de novo.
  pause
  exit /b 1
)

echo.
echo ============ PRONTO — auto-refund no ar apos o deploy do Vercel ============
pause
