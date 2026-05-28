@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist .git\index.lock del /f .git\index.lock
git add "lib/narration/section-tts.ts"
git add "lib/compose.ts"
git commit -m "Push #344: Dynamic AI Narration Engine Phase 2 -- section-level speed modulation"
git push origin main
echo Done!
pause
