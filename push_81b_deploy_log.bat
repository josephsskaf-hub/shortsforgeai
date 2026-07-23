@echo off
cd /d "%~dp0"
echo ===== KINEO PUSH 81 ===== > push_81_log.txt
echo [branch] >> push_81_log.txt
git rev-parse --abbrev-ref HEAD >> push_81_log.txt 2>&1
echo [status antes] >> push_81_log.txt
git status --short --branch >> push_81_log.txt 2>&1
echo [git add] >> push_81_log.txt
git add -- "app/globals.css" "app/(auth)/signup/page.tsx" "app/api/admin/send-free-upsell/route.ts" "app/api/cron/send-reminders/route.ts" "push_81b_deploy_log.bat" >> push_81_log.txt 2>&1
echo [staged] >> push_81_log.txt
git diff --cached --name-only >> push_81_log.txt 2>&1
echo [commit] >> push_81_log.txt
git commit -m "PUSH #81 no-login checkout + blue pre-select hover + free-upsell email machine" >> push_81_log.txt 2>&1
echo [push] >> push_81_log.txt
git push origin main >> push_81_log.txt 2>&1
echo [status depois] >> push_81_log.txt
git status --short --branch >> push_81_log.txt 2>&1
echo ===== FIM ===== >> push_81_log.txt
type push_81_log.txt
echo.
echo ============================================
echo  Terminou. Pode fechar. (log salvo em push_81_log.txt)
echo ============================================
pause
