@echo off
echo.
echo ============================================
echo  ShortsForgeAI — CRO Upgrade Push
echo ============================================
echo.
cd /d "%~dp0"
git add .
git commit -m "feat: high-conversion dashboard + premium UX

- Hero section with headline, trust signals, CTA scroll button
- 3 fake sample output cards with shimmer/gradient border effect
- PreviewModal: niche click -> preview -> confirm -> generate
- FullscreenLoader: animated multi-step progress bar (5 stages)
- Premium ResultCard: hook extracted, expandable script/desc, chips
- Global result action bar: Copy All Scripts, Regenerate, Another Niche
- Urgency banner: sticky free-gen counter + Upgrade Now CTA
- NicheCard: scale(1.025) hover + purple glow border effect
- Mobile sticky bottom CTA button (full-width, fixed)
- Responsive niche grid: 1-col mobile, 2-col tablet, 3-col desktop
- Trust signals: 1200+ creators, YouTube/TikTok/Reels in cards + sidebar
- Shimmer, ripple, gradient-border CSS animations added to globals.css
- Sidebar trust footer: 🔥 1,200+ active creators
- All existing generation logic, Supabase auth, Stripe unchanged"
git push origin main
echo.
echo ✅ Done! Changes pushed to main.
pause
