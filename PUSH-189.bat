@echo off
REM Push #189 — tech-forward pricing copy
REM Removes stale index.lock if present, then commits and pushes

if exist ".git\index.lock" (
    echo Removing stale index.lock...
    del /f ".git\index.lock"
)

git add app/pricing/page.tsx components/PricingCards.tsx lib/pricing.ts
git commit -m "feat: tech-forward pricing copy (push #189)"
git push origin main
pause
