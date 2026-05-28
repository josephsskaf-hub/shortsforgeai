@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
git add "app/(dashboard)/generate/GenerateClient.tsx"
git add "app/api/compose/route.ts"
git add "app/api/generate-script/route.ts"
git add "lib/compose.ts"
git add "lib/narration/personas.ts"
git add "lib/narration/niche-mapping.ts"
git commit -m "Push #343: Dynamic AI Narration Engine Phase 1 — persona-driven voice selection"
git push origin main
echo Done!
pause
