@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add components/PricingCards.tsx
git commit -m "fix(#262): simplify pricing cards to 2-col Basic+Pro — remove Free card, 2-col grid (was 3-col), Pro tagline now highlights 1 free Cinematic/month bonus"
git push origin main
pause
