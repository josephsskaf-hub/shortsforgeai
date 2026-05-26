@echo off
cd /d "%~dp0"
echo Killing any git processes...
taskkill /f /im git.exe 2>nul
taskkill /f /im git-remote-https.exe 2>nul
taskkill /f /im ssh.exe 2>nul
echo Waiting 3 seconds...
ping -n 4 127.0.0.1 >nul
echo Deleting lock files...
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
del /f ".git\packed-refs.lock" 2>nul
echo Waiting 2 more seconds...
ping -n 3 127.0.0.1 >nul
echo Updating local main ref to commit #281...
git update-ref refs/heads/main b95a42a8c2ef2ef3ce7c429ebe921a1ea7db9f15
echo Pushing commit #281 (redirect new signups to /pricing - fix client-no-payment gap)...
git push origin main
echo Done!
pause
