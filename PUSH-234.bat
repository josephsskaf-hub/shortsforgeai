@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #234 — Fix video duration, black gaps, prompt fidelity ===
if exist .git\index.lock del /f .git\index.lock
git add lib/openai.ts lib/compose.ts lib/runway.ts app/api/compose/route.ts app/api/analyze-idea/route.ts
git commit -m "Push #234 — Fix video duration, black gaps between clips, prompt fidelity"
git push origin main
echo === Done! Push #234 deployed ===
pause
