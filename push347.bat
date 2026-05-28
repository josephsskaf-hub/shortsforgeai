@echo off
if exist .git\index.lock del /f .git\index.lock
git add lib/compose.ts
git commit -m "Push #347: Fix TS2322 in compose.ts -- cast buffer.buffer as ArrayBuffer for Blob BlobPart compatibility"
git push origin main
echo.
echo Push #347 done!
pause
