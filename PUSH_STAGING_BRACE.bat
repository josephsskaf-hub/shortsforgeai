@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
git checkout staging
git add app\api\generate-thumbnail\route.ts
git commit -m "fix: add missing closing brace in route.ts POST function"
git push origin staging
git log --oneline -3 > C:\Users\win\Downloads\shortsforgeai\staging_brace_log.txt 2>&1
echo DONE >> C:\Users\win\Downloads\shortsforgeai\staging_brace_log.txt
pause
