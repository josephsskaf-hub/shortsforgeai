@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
git add lib/broll/ components/video/ app/api/broll-pexels/ app/api/regenerate-scene/ app/api/generate-broll-plan/ app/api/visual-director-status/ app/(dashboard)/generate/GenerateClient.tsx
git commit -m "Push #333: v3.0 Phase 2+3 — Relevance scoring, hybrid source, caption engine, Visual Director integration, Creator Mode toggle, scene history, scene preview"
git push origin main 2>&1
echo.
echo ======= DONE =======
pause
