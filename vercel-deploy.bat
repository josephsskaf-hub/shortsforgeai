@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo Checking vercel CLI...
where vercel 2>nul
if errorlevel 1 (
  echo Installing Vercel CLI...
  npm install -g vercel
)
echo Deploying to Vercel production...
vercel deploy --prod --yes
pause
