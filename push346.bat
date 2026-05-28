@echo off
if exist .git\index.lock del /f .git\index.lock
git checkout -- components/MobileNav.tsx components/PricingCards.tsx vercel.json "app/api/cron/refresh-viral-now/route.ts" "app/(dashboard)/history/HistoryClient.tsx"
echo Done - lock cleared and files restored
pause
