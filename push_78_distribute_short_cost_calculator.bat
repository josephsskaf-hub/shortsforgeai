@echo off
setlocal
cd /d "%~dp0"

git add -- "components/CostCalculatorLink.tsx" ^
  "components/Footer.tsx" ^
  "app/KineoLanding.tsx" ^
  "app/pricing/page.tsx" ^
  "app/alternatives/page.tsx" ^
  "app/cheapest-ai-shorts-maker/ShortCostCalculator.tsx" ^
  "scripts/measure-growth-funnel.mjs" ^
  "docs/growth/2026-07-23-calculator-internal-distribution.md" ^
  "docs/growth/2026-07-23-consolidated-kineo-summary.md" ^
  "push_78_distribute_short_cost_calculator.bat"

git diff --cached --quiet
if not errorlevel 1 (
  echo PUSH_78_NOTHING_TO_COMMIT
  exit /b 1
)

git commit -m "PUSH #78 distribute cost calculator internally"
if errorlevel 1 exit /b 1

git push origin main
if errorlevel 1 exit /b 1

echo PUSH_78_COMPLETE
endlocal
