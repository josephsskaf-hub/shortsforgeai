@echo off
setlocal
cd /d "%~dp0"

git add -- "app/(dashboard)/generate/GenerateClient.tsx" ^
  "app/api/geo/route.ts" ^
  "app/api/stripe/checkout/route.ts" ^
  "app/pricing/page.tsx" ^
  "lib/checkoutPricing.ts" ^
  "scripts/measure-source-funnel.mjs" ^
  "package.json" ^
  "docs/growth/2026-07-23-post-video-local-currency-and-source-funnel.md" ^
  "docs/growth/2026-07-23-consolidated-kineo-summary.md" ^
  "push_73_post_video_currency_source_funnel.bat"

git diff --cached --quiet
if not errorlevel 1 (
  echo PUSH_73_NOTHING_TO_COMMIT
  exit /b 1
)

git commit -m "PUSH #73 localize post-video checkout offer"
if errorlevel 1 exit /b 1

git push origin main
if errorlevel 1 exit /b 1

echo PUSH_73_COMPLETE
endlocal
