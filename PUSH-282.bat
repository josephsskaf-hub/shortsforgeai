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
echo Updating local main ref to commit #282...
git update-ref refs/heads/main ed3b4baf88eb28bd10d18e33a203ba34f86ceeca
echo Pushing commit #282 (fix welcome email - remove stale free-credit copy, link to /pricing)...
git push origin main
echo Done!
pause
