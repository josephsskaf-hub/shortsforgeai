@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
git worktree prune
if exist ".git\index.lock" del /f ".git\index.lock"
git checkout staging
git add app\api\generate-thumbnail\route.ts
git commit -m "fix: route.ts regex range error + r.data null safety - staging build fix"
git push origin staging
git log --oneline -5 > C:\Users\win\Downloads\shortsforgeai\staging_push_log.txt 2>&1
echo Done >> C:\Users\win\Downloads\shortsforgeai\staging_push_log.txt
pause
