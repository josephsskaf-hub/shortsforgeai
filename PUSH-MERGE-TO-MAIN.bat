@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git checkout main
git pull origin main
git merge stage/render-v2 --no-ff -m "merge: stage/render-v2 into main — navbar fullwidth, 4 clean links, cyan palette, rm Pexels, rm CTA voice bug"
git push origin main
pause
