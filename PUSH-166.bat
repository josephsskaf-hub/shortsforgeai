@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git add app/api/stripe/checkout/route.ts app/api/stripe/webhook/route.ts PUSH-166.bat
git commit -m "fix: allow repeat purchases to stack credits + webhook secret guard (#166)"
git push origin main
echo.
echo Done! Pushed repeat-purchase unlock + webhook guard.
pause
