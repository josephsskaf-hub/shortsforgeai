@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo Pushing fix for #167 (full file, not truncated)...
echo.
git log --oneline -3
echo.
git push origin main
echo.
echo Done!
pause
