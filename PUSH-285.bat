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
echo Updating local main ref to commit #285...
git update-ref refs/heads/main 1970ab6c5d8fe2170fcd16e320330948fd407408
echo Pushing commit #285 (fix CRLF in signup/page.tsx - unblocks Vercel build)...
git push origin main
echo Done!
pause
