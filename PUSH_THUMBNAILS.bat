@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
git worktree prune
git add app\api\generate-thumbnail\route.ts
git commit -m "fix: strip null bytes from route.ts - clean Python write"
git push -u origin main
git log --oneline -3 > C:\Users\win\Downloads\shortsforgeai\git_log.txt 2>&1
echo Done >> C:\Users\win\Downloads\shortsforgeai\git_log.txt
pause
