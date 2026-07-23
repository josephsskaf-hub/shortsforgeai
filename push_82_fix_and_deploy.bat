@echo off
cd /d "%~dp0"
echo ===== KINEO PUSH 82 ===== > push_82_log.txt
echo [set identity - local ao repo] >> push_82_log.txt
git config user.email "josephsskaf@gmail.com" >> push_82_log.txt 2>&1
git config user.name "Joseph Skaf" >> push_82_log.txt 2>&1
echo [git add] >> push_82_log.txt
git add -- "app/globals.css" "app/(auth)/signup/page.tsx" "app/api/admin/send-free-upsell/route.ts" "app/api/cron/send-reminders/route.ts" "push_82_fix_and_deploy.bat" >> push_82_log.txt 2>&1
echo [staged] >> push_82_log.txt
git diff --cached --name-only >> push_82_log.txt 2>&1
echo [commit] >> push_82_log.txt
git commit -m "PUSH #82 no-login checkout + blue pre-select hover + free-upsell email machine" >> push_82_log.txt 2>&1
echo [push] >> push_82_log.txt
git push origin main >> push_82_log.txt 2>&1
echo [status depois] >> push_82_log.txt
git status --short --branch >> push_82_log.txt 2>&1
echo ===== FIM ===== >> push_82_log.txt
type push_82_log.txt
echo.
echo ============================================
echo  Terminou. Pode fechar.
echo ============================================
pause
