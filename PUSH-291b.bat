@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
del /f /q .git\index.lock 2>nul
del /f /q "0.4" 2>nul
del /f /q "4-step" 2>nul
del /f /q "gpt-4o" 2>nul
git push origin main
echo.
echo === Push #291 complete. Check above for errors. ===
pause
