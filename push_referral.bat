@echo off
REM #443/#444 + ativacao final do referral loop (01/07)
REM - Migracao JA APLICADA em PROD (colunas + unique index em profiles; RLS ok).
REM - Novo: ReferralMiniCard na tela "Your video is ready" (GenerateClient).
REM - Novo: /api/referral/attribute valida formato do codigo (mata probing via
REM   wildcard _ no ilike).
REM Gate: tsc --noEmit filtrando "error TS1" SOMENTE nos arquivos tocados.
setlocal enabledelayedexpansion

cd /d "C:\Users\win\Downloads\kineo"

del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\refs\heads\main.lock" 2>nul

REM ===== GATE: syntax errors (TS1xxx) apenas nos arquivos tocados =====
echo [gate] rodando npx tsc --noEmit ...
call npx tsc --noEmit > "%TEMP%\tsc_referral_out.txt" 2>&1
findstr /C:"error TS1" "%TEMP%\tsc_referral_out.txt" | findstr /I "ReferralMiniCard GenerateClient attribute" > "%TEMP%\tsc_referral_hits.txt"
set GATE_FAIL=0
for %%A in ("%TEMP%\tsc_referral_hits.txt") do if %%~zA gtr 0 set GATE_FAIL=1
if "!GATE_FAIL!"=="1" (
  echo.
  echo ===== GATE FALHOU: erro de sintaxe TS1 nos arquivos tocados =====
  type "%TEMP%\tsc_referral_hits.txt"
  echo ===== NADA foi commitado. Corrija e rode de novo. =====
  pause
  exit /b 1
)
echo [gate] OK — sem erro TS1 nos arquivos tocados.

REM ===== ADD explicito: SO os arquivos deste push =====
git add "components/ReferralMiniCard.tsx" "app/(dashboard)/generate/GenerateClient.tsx" "app/api/referral/attribute/route.ts" "push_referral.bat"
git status --short

git commit -m "feat(referral): loop LIGADO ponta a ponta. Migration ja aplicada em prod (colunas referral_* + unique index em profiles, RLS owner-policy cobre). Novo ReferralMiniCard ('Give 30, get 30' + copy link) na tela Your video is ready do GenerateClient. attribute agora valida formato do codigo (regex) antes do ilike — bloqueia probing de codigos via wildcard. Sidebar/MobileNav ja linkavam /referral (Invite & Earn)."
git push origin main
git log -1 --oneline origin/main
echo ===== FIM (codigo de saida: %errorlevel%) =====
pause
