@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #231 — Homepage trust ^& conversion ===
if exist .git\index.lock del /f .git\index.lock
git add app/HomePageClient.tsx app/api/stats/route.ts
git commit -m "Push #231 — Homepage trust & conversion: testimonials, guarantee, FAQ

Testimonials: What creators are saying — 3 cards (5-star, UI Avatars photo, niche, highlighted result)
Guarantee: 7-day money-back badge with shield under pricing CTAs
How it works: refreshed steps (type topic, AI builds script+clips, download in 35s) + connector line
This week: X videos created this week in hero, backed by new week count in /api/stats
FAQ: 5-question objection accordion before final CTA"
git push origin main
echo === Done! Push #231 deployed ===
pause
