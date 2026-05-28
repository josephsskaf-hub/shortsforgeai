@echo off
if exist .git\index.lock del /f .git\index.lock
git add app/api/generate-video-fast/route.ts CLAUDE.md
git commit -m "Push #346: v3.0 Phase 1 COMPLETE -- BrollPlan queries wired into generate-video-fast; AI Visual Director pexelsQuery now overrides GPT scene queries for pinpoint Pexels results"
git push origin main
echo.
echo Push #346 done!
pause
