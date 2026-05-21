@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del .git\HEAD.lock 2>nul
del .git\config.lock 2>nul
del .git\index.lock 2>nul
git add -A
git commit -m "feat: homepage shows niche grid immediately - product-first experience"
git push origin main
echo Push concluido!
pause
