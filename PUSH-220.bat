@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #220 — Remove phone mockup from homepage hero ===
if exist .git\index.lock del /f .git\index.lock
git add app/HomePageClient.tsx
git commit -m "Push #220 — Remove phone mockup card from hero

User feedback: phone mockup card on homepage looks bad.
Removed HeroPhone component and phone card carousel.
Hero is now clean: headline + CTA only."
git push origin main
echo === Done! Push #220 deployed ===
pause
