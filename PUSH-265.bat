@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/api/stripe/checkout/route.ts app/api/stripe/webhook/route.ts
git commit -m "feat(#265): remove 7-day free trial — no more $0 entry point; checkout now requires payment upfront; webhook grants full plan credits immediately at checkout.session.completed (not 10 trial credits); is_trial metadata removed"
git push origin main
pause
