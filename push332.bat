@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
git add lib/broll/ components/video/ app/api/generate-broll-plan/ app/api/regenerate-scene/ CLAUDE.md
git commit -m "Push #332: v3.0 Phase 1 — B-roll Intelligence System (Visual Director, Scene Schema, Attention Curve, Prompt Builder)"
git push origin main 2>&1
echo.
echo ======= DONE =======
echo Check https://vercel.com/josephsskaf-hubs-projects/shortsforgeai/deployments
pause
