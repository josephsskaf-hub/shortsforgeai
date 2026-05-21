@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo Pushing commit #167 to GitHub...
echo.
git log --oneline -2
echo.
git push origin main
echo.
echo Done!
pause
