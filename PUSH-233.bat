@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #233 — Track checkout clicks + admin cards ===
if exist .git\index.lock del /f .git\index.lock
git add lib/trackClick.ts app/api/track-click/route.ts app/api/admin/click-stats/route.ts supabase/migrations/008_click_events.sql app/HomePageClient.tsx app/pricing/page.tsx "app/(dashboard)/generate/GenerateClient.tsx" app/checkout/cancelled/page.tsx "app/(dashboard)/admin/metrics/MetricsClient.tsx"
git commit -m "Push #233 — Track Basic/Pro checkout clicks + admin cards

Tracking: trackCheckoutClick() POSTs { event:checkout_click, plan } to /api/track-click
Wired into all Stripe-initiating buttons: home handleStartPlan, pricing handleBuy, generate handleUpgradeNow + pro anchor, checkout-cancelled links
API: /api/track-click writes to click_events via service role (user_id from session); always 200
Admin: new Basic Clicks / Pro Clicks cards in metrics dashboard via /api/admin/click-stats
DB: migration 008_click_events.sql (id, event, plan, user_id, created_at) + SQL in route comments"
git push origin main
echo === Done! Push #233 deployed ===
pause
