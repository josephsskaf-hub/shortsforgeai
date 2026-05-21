@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo Pulling and rebasing from origin/main...
git pull --rebase origin main > C:\Users\win\Downloads\push_result.txt 2>&1
echo Pull result: %ERRORLEVEL% >> C:\Users\win\Downloads\push_result.txt
echo Pushing to origin/main... >> C:\Users\win\Downloads\push_result.txt
git push origin main >> C:\Users\win\Downloads\push_result.txt 2>&1
echo Push result: %ERRORLEVEL% >> C:\Users\win\Downloads\push_result.txt
type C:\Users\win\Downloads\push_result.txt
echo.
echo Done! Press any key to close.
pause
