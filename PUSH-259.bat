@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/api/stripe/checkout/route.ts app/api/stripe/webhook/route.ts
git commit -m "feat(#259): 7-day free trial + abandoned checkout tracking — (1) checkout: first-time subscribers get trial_period_days=7 with is_trial metadata; (2) webhook: trial sessions get 10 trial credits at checkout.session.completed (not full 50/100); full plan credits granted on first real payment via invoice.payment_succeeded; (3) webhook: checkout.session.expired logs to checkout_abandoned table for drop-off analysis"
git push origin main
pause
