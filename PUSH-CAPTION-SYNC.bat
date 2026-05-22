@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git add lib/compose.ts
git add app/api/compose/route.ts
git commit -m "fix: caption sync via Whisper word timestamps (push #175) — captions now key to exact narrator speech timing instead of proportional word-count estimate"
git push origin main
pause
