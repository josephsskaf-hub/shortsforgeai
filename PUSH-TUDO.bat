@echo off
title ShortsForgeAI - Push TUDO (#130 + #131 + #132)
color 0A
cd /d "%~dp0"

echo.
echo ============================================================
echo  PUSH TUDO — fixes #130, #131, #132 em sequencia
echo  #130: fix crash (videoCounter)
echo  #131: fix cards opacity (videos visiveis)
echo  #132: fix CDN videos (Google 403 - usa Pexels agora)
echo ============================================================
echo.

if exist ".git\index.lock" (
    echo Removendo index.lock...
    del /f /q ".git\index.lock"
)

echo [1/3] Commitando todos os arquivos...
git add app\HomePageClient.tsx
git add app\api\showcase-clips\route.ts

git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "Push #130-132: fix crash + opacity + showcase videos via Pexels CDN"
    echo Commitado com sucesso.
) else (
    echo Nada novo para commitar - tudo ja foi enviado antes.
)

echo [2/3] Sincronizando com GitHub...
git fetch origin
git merge origin/main -X ours --no-edit

echo [3/3] Enviando para GitHub...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo  FEITO! Site volta ao ar em ~1 min no Vercel.
    echo  Acessa: https://shortsforgeai.vercel.app
    echo ============================================================
) else (
    echo.
    echo ERRO: push falhou. Verifique o output acima.
)

echo.
pause
