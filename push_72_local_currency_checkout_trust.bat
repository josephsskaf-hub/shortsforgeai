@echo off
setlocal
cd /d "%~dp0"

git add -- "app/pricing/page.tsx" ^
  "app/api/geo/route.ts" ^
  "scripts/inspect-checkout-abandonment.mjs" ^
  "package.json" ^
  "docs/growth/2026-07-23-local-currency-checkout-trust.md" ^
  "docs/growth/2026-07-23-consolidated-kineo-summary.md" ^
  "push_72_local_currency_checkout_trust.bat"

git diff --cached --quiet
if not errorlevel 1 (
  echo PUSH_72_NOTHING_TO_COMMIT
  exit /b 1
)

git commit -m "PUSH #72 align pricing currency with checkout"
if errorlevel 1 exit /b 1

git push origin main
if errorlevel 1 exit /b 1

echo PUSH_72_COMPLETE
endlocal
