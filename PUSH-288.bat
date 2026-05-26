@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
echo === Fixing git state and committing conversion-v1 ===
del /f /q .git\index.lock 2>nul
echo index.lock removed (or wasn't there)
git checkout conversion-v1
git add app/pricing/page.tsx
git add app/api/stripe/checkout/route.ts
git add app/api/stripe/webhook/route.ts
git add app/api/send-welcome/route.ts
git add app/api/cron/send-reminders/route.ts
git add vercel.json
git add supabase-reminder-migration.sql
git status
git commit -m "feat(conversion-v1): 3-day trial funnel — pricing, checkout, webhook, emails, cron

- pricing: Pro-first order, social proof row, exit-intent modal,
  trial CTAs ('Start Free 3-Day Trial'), sticky mobile trial buttons
- checkout: trial_period_days=3 added to subscription_data
- webhook: detect trial checkout (payment_status=no_payment_required),
  grant 5 preview credits for trial, full credits on first payment
- send-welcome: rewritten email for trial funnel (cyan hero, trial CTA)
- send-reminders: new cron route — 24h nudge for free users who haven't
  started trial yet; marks reminder_sent_at to prevent duplicates
- vercel.json: daily cron at 10:00 UTC for send-reminders
- supabase-reminder-migration.sql: adds reminder_sent_at column + index

Push #288"
git push origin conversion-v1
echo === Done ===
pause
