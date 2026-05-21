@echo off
cd /d "%~dp0"
echo.
echo ==========================================
echo   ShortsForgeAI - Git Push Automatico
echo ==========================================
echo.

git add .

echo Arquivos adicionados. Criando commit...
echo.

set /p MSG="Mensagem do commit (ou Enter para usar padrao): "
if "%MSG%"=="" set MSG=update: latest changes

git commit -m "%MSG%"

echo.
echo Fazendo push para branch main...
git push origin main

echo.
if %ERRORLEVEL%==0 (
    echo ==========================================
    echo   Push realizado com sucesso!
    echo ==========================================
) else (
    echo ==========================================
    echo   Erro no push. Verifique acima.
    echo ==========================================
)
echo.
pause
