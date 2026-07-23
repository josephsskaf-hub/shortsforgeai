@echo off
setlocal
cd /d "%~dp0"

git add -- "components/PricingCards.tsx" ^
  "scripts/measure-source-funnel.mjs" ^
  "docs/growth/2026-07-23-inline-pricing-local-currency.md" ^
  "docs/growth/2026-07-23-consolidated-kineo-summary.md" ^
  "push_74_inline_pricing_local_currency.bat"

git diff --cached --quiet
if not errorlevel 1 (
  echo PUSH_74_NOTHING_TO_COMMIT
  exit /b 1
)

git commit -m "PUSH #74 localize inline pricing cards"
if errorlevel 1 exit /b 1

git push origin main
if errorlevel 1 exit /b 1

echo PUSH_74_COMPLETE
endlocal
