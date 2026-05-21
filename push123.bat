@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
if exist .git\index.lock del /f .git\index.lock
git add -A
git commit -m "Push #123 — auto-redirect post-checkout success/cancel"
git push origin main
echo.
echo Done! Press any key to close.
pause
