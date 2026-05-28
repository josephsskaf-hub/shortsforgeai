@echo off
echo Checking Node/npm...
node --version
npm --version
echo.
echo Checking if vercel CLI is installed...
where vercel 2>nul && vercel --version || echo "vercel CLI not found"
echo.
pause
