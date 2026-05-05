@echo off
title ShortsForgeAI - Push da correcao
color 0A
echo.
echo Fazendo push da correcao do TypeScript...
echo.

cd /d "C:\Users\win\Downloads\shortsforgeai"

git add lib/supabase/middleware.ts
git commit -m "fix: TypeScript type for cookiesToSet"
git push origin main

echo.
echo ============================================
echo   CORRECAO ENVIADA! Vercel vai redeployar.
echo ============================================
echo.
pause
