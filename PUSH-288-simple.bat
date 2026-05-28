@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
del /f /q .git\index.lock 2>nul
git push origin conversion-v1
echo.
echo === Push complete. Check above for errors. ===
pause
