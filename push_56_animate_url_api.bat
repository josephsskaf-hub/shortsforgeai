@echo off
setlocal
cd /d C:\Users\win\Downloads\kineo

git add -- ^
  "app/(dashboard)/animate/AnimateClient.tsx" ^
  "app/(dashboard)/animate/page.tsx" ^
  "app/api/animate-image/route.ts" ^
  "app/api/animate/route.ts" ^
  "app/api/avatar-status/route.ts" ^
  "app/api/cron/send-reminders/route.ts" ^
  "docs/animate-api.md" ^
  "lib/animate/claim.ts" ^
  "lib/animate/remoteImage.ts" ^
  "lib/animate/requestAuth.ts" ^
  "lib/animate/service.ts" ^
  "lib/avatar/storage.ts" ^
  "lib/avatar/veed.ts" ^
  "push_56_animate_url_api.bat"
if errorlevel 1 exit /b 1

git diff --cached --check
if errorlevel 1 exit /b 1

git commit -m "PUSH #56 secure URL input and batch API for Animate"
if errorlevel 1 exit /b 1

git push origin main
if errorlevel 1 exit /b 1

endlocal
