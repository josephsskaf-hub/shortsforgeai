@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del .git\HEAD.lock 2>nul
del .git\config.lock 2>nul
del .git\index.lock 2>nul
git add -A
git commit -m "feat: full platform copywriting upgrade - viral growth machine positioning"
git push origin main
echo Push concluido!
pause
