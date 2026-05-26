@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add components/PricingCards.tsx
git commit -m "fix(#261): pricing cards 1-click flow — card click now goes directly to checkout instead of just selecting the card visually (removes 2-step select+confirm)"
git push origin main
pause
