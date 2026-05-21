@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
git push origin staging
git log --oneline -5 > C:\Users\win\Downloads\shortsforgeai\staging_only_log.txt 2>&1
git log --oneline remotes/origin/staging -3 >> C:\Users\win\Downloads\shortsforgeai\staging_only_log.txt 2>&1
echo PUSH DONE >> C:\Users\win\Downloads\shortsforgeai\staging_only_log.txt
pause
