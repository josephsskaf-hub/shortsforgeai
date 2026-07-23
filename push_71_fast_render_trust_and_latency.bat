@echo off
setlocal
cd /d "%~dp0"

git add -- "app/(dashboard)/generate/GenerateClient.tsx" ^
  "app/KineoLanding.tsx" ^
  "app/free-ai-shorts/[niche]/page.tsx" ^
  "app/viral-score/ViralScoreClient.tsx" ^
  "components/PreviewModal.tsx" ^
  "app/v/[id]/page.tsx" ^
  "app/v/[id]/opengraph-image.tsx" ^
  "app/og-image.png/route.tsx" ^
  "app/alternatives/[competitor]/page.tsx" ^
  "components/Footer.tsx" ^
  "app/(auth)/signup/page.tsx" ^
  "app/HomePageClient.tsx" ^
  "app/free-hook-generator/FreeHookClient.tsx" ^
  "app/free-script-generator/FreeScriptClient.tsx" ^
  "app/api/admin/send-pack-offer/route.ts" ^
  "components/SocialProof.tsx" ^
  "components/SocialProofToast.tsx" ^
  "app/pt/page.tsx" ^
  "scripts/measure-render-latency.mjs" ^
  "package.json" ^
  "docs/growth/2026-07-23-fast-render-trust-and-latency.md" ^
  "push_71_fast_render_trust_and_latency.bat"

git diff --cached --quiet
if not errorlevel 1 (
  echo PUSH_71_NOTHING_TO_COMMIT
  exit /b 1
)

git commit -m "PUSH #71 make Fast render timing truthful"
if errorlevel 1 exit /b 1

git push origin main
if errorlevel 1 exit /b 1

echo PUSH_71_COMPLETE
endlocal
