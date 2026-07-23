@echo off
cd /d "%~dp0"
echo ===== KINEO PUSH 84 (fix hub build) ===== > push_84_log.txt
git config user.email "josephsskaf@gmail.com" >> push_84_log.txt 2>&1
git config user.name "Joseph Skaf" >> push_84_log.txt 2>&1
git add -- "app/free-ai-shorts/page.tsx" "push_84_fix_hub.bat" >> push_84_log.txt 2>&1
echo [staged] >> push_84_log.txt
git diff --cached --name-only >> push_84_log.txt 2>&1
echo [commit] >> push_84_log.txt
git commit -m "PUSH #84 fix free-ai-shorts hub build: add 8 niche cards + guard against missing slug" >> push_84_log.txt 2>&1
echo [push] >> push_84_log.txt
git push origin main >> push_84_log.txt 2>&1
git status --short --branch >> push_84_log.txt 2>&1
echo ===== FIM ===== >> push_84_log.txt
type push_84_log.txt
echo.
echo ====== Terminou. Pode fechar. ======
pause
