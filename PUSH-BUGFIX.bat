@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
git add app/api/generate/route.ts lib/stripe.ts app/api/stripe/checkout/route.ts app/layout.tsx app/icon.png app/favicon.ico PUSH-BUGFIX.bat
git commit -m "fix: generate parsing + stripe checkout 500 + favicon SF"
git push origin main
echo.
echo Done! Pushed bug fixes + favicon.
echo.
pause
