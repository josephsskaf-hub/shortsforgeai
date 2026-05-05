@echo off
echo === ShortsForgeAI Deploy Script ===
cd /d "%~dp0"

echo Inicializando Git...
git init -b main
git config user.email "josephsskaf@gmail.com"
git config user.name "Joseph Skaf"

echo Criando .gitignore...
echo node_modules/ > .gitignore
echo .next/ >> .gitignore
echo .env.local >> .gitignore

echo Adicionando arquivos...
git add -A
git commit -m "Initial ShortsForgeAI Next.js MVP"

echo Conectando ao GitHub...
git remote add origin https://github.com/josephsskaf-hub/shortsforgeai.git
git push -u origin main

echo.
echo === Deploy no Vercel ===
echo Instale o Vercel CLI: npm install -g vercel
echo Depois rode: vercel --prod
echo.
pause
