@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
git add .
git commit -m "fix: generate parsing + stripe checkout 500"
git push origin main
echo Done! Pushed bug fixes.
pause
