@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo ========================================
echo  DEPLOY DIRETO PARA VERCEL (sem webhook)
echo ========================================
echo.

:: Checa se vercel CLI esta instalado
where vercel >nul 2>&1
if errorlevel 1 (
  echo Instalando Vercel CLI globalmente...
  npm install -g vercel
  echo.
)

echo Versao do Vercel CLI:
vercel --version
echo.

echo Deployando para producao...
vercel deploy --prod --yes --cwd "C:\Users\win\Downloads\shortsforgeai"
echo.
echo ========================================
echo  Deploy concluido! Verifique o Vercel.
echo ========================================
pause
