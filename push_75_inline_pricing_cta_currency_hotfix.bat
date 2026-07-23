@echo off
setlocal
cd /d "%~dp0"

git add -- "components/PricingCards.tsx" ^
  "docs/growth/2026-07-23-inline-pricing-local-currency.md" ^
  "docs/growth/2026-07-23-consolidated-kineo-summary.md" ^
  "push_75_inline_pricing_cta_currency_hotfix.bat"

git diff --cached --quiet
if not errorlevel 1 (
  echo PUSH_75_NOTHING_TO_COMMIT
  exit /b 1
)

git commit -m "PUSH #75 remove inline pricing USD CTA residue"
if errorlevel 1 exit /b 1

git push origin main
if errorlevel 1 exit /b 1

echo PUSH_75_COMPLETE
endlocal
