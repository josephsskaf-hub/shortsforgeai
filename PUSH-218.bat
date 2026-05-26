@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #218 — Homepage redesign: split hero + Recent Shorts video carousel ===
echo Removing stale git lock if present...
if exist .git\index.lock del /f .git\index.lock
git add app/HomePageClient.tsx
git commit -m "Push #218 — Redesign homepage hero: split layout with auto-playing phone mockup + Recent Shorts video carousel

Make the landing page feel alive with video, InVideo.ai style.

Hero is now a two-column split:
  - Left: headline + subhead + live counter + green CTA (existing copy, left-aligned on desktop)
  - Right: HeroPhone — 280px 9:16 phone mockup (border-2 gray-700, rounded-3xl)
    auto-playing muted looping clip from /api/showcase-clips, Viral Score badge
    top-right + caption overlay bottom. Repurposed the dead HeroVideo component.

Added a Recent Shorts carousel directly under the hero (4 phone-frame cards,
autoplay muted loop playsInline) and removed the now-duplicate old Real Shorts
section. Enhanced PhoneCard with a Viral Score badge (top-right) and category
tag (top-left) over the title overlay.

Textarea prompt card, testimonials and social-proof bar preserved. Video URLs
still come from the existing /api/showcase-clips fetch (Pexels) with the same
hardcoded portrait fallbacks — no new CDN hardcodes, generate/auth flows untouched."
git push origin main
echo === Done! Push #218 deployed ===
pause
