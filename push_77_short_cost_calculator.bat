@echo off
setlocal
cd /d "%~dp0"

git add -- "app/cheapest-ai-shorts-maker/page.tsx" ^
  "app/cheapest-ai-shorts-maker/ShortCostCalculator.tsx" ^
  "scripts/measure-growth-funnel.mjs" ^
  "docs/growth/2026-07-23-short-cost-calculator.md" ^
  "docs/growth/2026-07-23-consolidated-kineo-summary.md" ^
  "push_77_short_cost_calculator.bat"

git diff --cached --quiet
if not errorlevel 1 (
  echo PUSH_77_NOTHING_TO_COMMIT
  exit /b 1
)

git commit -m "PUSH #77 add local cost-per-Short calculator"
if errorlevel 1 exit /b 1

git push origin main
if errorlevel 1 exit /b 1

echo PUSH_77_COMPLETE
endlocal
