@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git add app/admin/page.tsx app/checkout/success/page.tsx PUSH-165.bat
git commit -m "fix: admin total users from auth.users + Google Ads conversion tracking (#165)"
git push origin main
echo.
echo Done! Pushed admin user count fix + conversion tracking.
pause
