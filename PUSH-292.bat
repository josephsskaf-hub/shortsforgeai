@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
del /f /q .git\index.lock 2>nul
git add lib/compose.ts
git add lib/runway.ts
git add app/api/scenes/route.ts
git status
git commit -m "feat(#292): OpusClip-quality video upgrade — UPPERCASE caps, Ken Burns zoom, tts-1-hd, shotType, vignette, 3-word chunks"
git push origin main
echo.
echo === Push #292 complete. Check above for errors. ===
pause
