@echo off
setlocal
cd /d "%~dp0"

git add -- "app/globals.css" "app/(auth)/signup/page.tsx" "app/api/admin/send-free-upsell/route.ts" "app/api/cron/send-reminders/route.ts" "push_81_growth_email_machine.bat"

git diff --cached --quiet
if not errorlevel 1 (
  echo PUSH_81_NOTHING_TO_COMMIT
  exit /b 1
)

git commit -m "PUSH #81 no-login checkout + blue pre-select hover + free-upsell email machine wired to daily cron"
if errorlevel 1 exit /b 1

git push origin main
if errorlevel 1 exit /b 1

echo PUSH_81_COMPLETE
endlocal
