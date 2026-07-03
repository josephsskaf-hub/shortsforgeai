@echo off
if exist ".git\index.lock" del /f ".git\index.lock"
cd /d C:\Users\win\Downloads\kineo

echo === Push #485 - FALLBACK-B geo: lugares extremos deixam de cair em skyline corporativo ===
echo.

echo === GATE: tsc escopado ao arquivo tocado ===
call npx tsc --noEmit > tsc_geo_fallback.txt 2>&1
findstr /C:"lib/stockLibrary.ts" /C:"lib\stockLibrary.ts" tsc_geo_fallback.txt > tsc_geo_fallback_hits.txt
for %%A in (tsc_geo_fallback_hits.txt) do if %%~zA gtr 0 goto :err
echo GATE OK - zero erros de tipo no arquivo tocado
echo.

git add lib/stockLibrary.ts
git add push_geo_fallback.bat
git commit -m "Push #485: FALLBACK-B geo keyword routing - volcano/glacier/desert/island/cave/storm etc. mapeados pra nature/ocean/dark/mystery em vez do pool neutro city/business; espelha o concept map geo do #482 no pixabay.ts"
if errorlevel 1 goto :err

git push origin main
if errorlevel 1 goto :err

echo.
echo === PUSH OK - #485 no ar ===
pause
exit /b 0

:err
echo.
echo === ERRO - gate ou git falhou. Erros escopados abaixo, log completo em tsc_geo_fallback.txt ===
if exist tsc_geo_fallback_hits.txt type tsc_geo_fallback_hits.txt
pause
exit /b 1
