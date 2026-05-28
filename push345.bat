@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
git add "lib/narration/niche-mapping.ts"
git add "lib/narration/section-tts.ts"
git add "lib/compose.ts"
git add "app/api/compose/route.ts"
git commit -m "Push #345: Dynamic AI Narration Engine Phase 3+4+5 -- language routing, speed jitter, mystery pause, persona in response"
git push origin main
echo Done!
pause
