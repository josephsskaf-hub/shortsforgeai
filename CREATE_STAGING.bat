@echo off
echo Step 1 > C:\Users\win\Downloads\shortsforgeai\debug.txt
cd /d "C:\Users\win\Downloads\shortsforgeai"
echo Step 2 >> C:\Users\win\Downloads\shortsforgeai\debug.txt
git worktree prune >> C:\Users\win\Downloads\shortsforgeai\debug.txt 2>&1
echo Step 3 >> C:\Users\win\Downloads\shortsforgeai\debug.txt
git checkout main >> C:\Users\win\Downloads\shortsforgeai\debug.txt 2>&1
echo Step 4 >> C:\Users\win\Downloads\shortsforgeai\debug.txt
git checkout -B staging >> C:\Users\win\Downloads\shortsforgeai\debug.txt 2>&1
echo Step 5 >> C:\Users\win\Downloads\shortsforgeai\debug.txt
git push -u origin staging >> C:\Users\win\Downloads\shortsforgeai\debug.txt 2>&1
echo DONE >> C:\Users\win\Downloads\shortsforgeai\debug.txt
pause
