@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
git push origin main > C:\Users\win\Downloads\push_result.txt 2>&1
echo Exit code: %ERRORLEVEL% >> C:\Users\win\Downloads\push_result.txt
type C:\Users\win\Downloads\push_result.txt
echo.
echo Done! Press any key to close.
pause
