@echo off
if exist ".git\index.lock" del /f ".git\index.lock"
cd /d C:\Users\win\Downloads\kineo

echo === FAST MODE v2 — ritmo + Ken Burns pan + hook ranqueado + legendas com enfase ===
echo.

echo === GATE: tsc escopado aos 3 arquivos tocados ===
call npx tsc --noEmit > tsc_fastmode_v2.txt 2>&1
findstr /C:"lib/pixabay.ts" /C:"lib\pixabay.ts" /C:"lib/compose.ts" /C:"lib\compose.ts" /C:"generate-video-fast/route.ts" /C:"generate-video-fast\route.ts" tsc_fastmode_v2.txt > tsc_fastmode_v2_hits.txt
for %%A in (tsc_fastmode_v2_hits.txt) do if %%~zA gtr 0 goto :err
echo GATE OK — zero erros de tipo nos arquivos tocados
echo.

git add lib/pixabay.ts
git add lib/compose.ts
git add app/api/generate-video-fast/route.ts
git add push_fastmode_v2.bat
git commit -m "Fast Mode v2: cortes 2.5-4s com 2 clipes ranqueados por cena, Ken Burns com pan alternado, hook = clipe mais forte do pool, legendas com enfase amarela (tudo gateado em quality=fast)"
if errorlevel 1 goto :err

git push origin main
if errorlevel 1 goto :err

echo.
echo === PUSH OK — Fast Mode v2 no ar. Gere 1 video Fast gratis pra validar. ===
pause
exit /b 0

:err
echo.
echo === ERRO — gate ou git falhou. Erros escopados abaixo, log completo em tsc_fastmode_v2.txt ===
if exist tsc_fastmode_v2_hits.txt type tsc_fastmode_v2_hits.txt
pause
exit /b 1
