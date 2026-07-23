@echo off
setlocal
cd /d "%~dp0"

git add -- "app/(auth)/login/page.tsx" ^
  "app/(auth)/signup/page.tsx" ^
  "app/(dashboard)/my-videos/MyVideosClient.tsx" ^
  "app/HomePageClient.tsx" ^
  "app/ai-shorts-without-filming/page.tsx" ^
  "app/alternatives/[competitor]/page.tsx" ^
  "app/alternatives/page.tsx" ^
  "app/api/cron/send-activation-nudge/route.ts" ^
  "app/api/lead-capture/route.ts" ^
  "app/api/video-summary/route.ts" ^
  "app/cheapest-ai-shorts-maker/page.tsx" ^
  "app/faceless-video-generator/page.tsx" ^
  "app/facts/page.tsx" ^
  "app/free-ai-shorts/[niche]/page.tsx" ^
  "app/free-hook-generator/page.tsx" ^
  "app/free-script-generator/FreeScriptClient.tsx" ^
  "app/free-script-generator/page.tsx" ^
  "app/from-youtube/page.tsx" ^
  "app/layout.tsx" ^
  "app/manifest.ts" ^
  "app/start/layout.tsx" ^
  "app/text-to-video-shorts/page.tsx" ^
  "app/youtube-shorts-from-topic/page.tsx" ^
  "public/llms.txt" ^
  "docs/growth/2026-07-23-answer-engine-speed-truth.md" ^
  "docs/growth/2026-07-23-consolidated-kineo-summary.md" ^
  "push_76_answer_engine_speed_truth.bat"

git diff --cached --quiet
if not errorlevel 1 (
  echo PUSH_76_NOTHING_TO_COMMIT
  exit /b 1
)

git commit -m "PUSH #76 align answer-engine claims with measured speed"
if errorlevel 1 exit /b 1

git push origin main
if errorlevel 1 exit /b 1

echo PUSH_76_COMPLETE
endlocal
