@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del .git\HEAD.lock 2>nul
del .git\config.lock 2>nul
del .git\index.lock 2>nul
git add -A
git commit -m "feat: premium output cards with copy + download + generate again"
git push origin main
echo Push concluido!
pause
