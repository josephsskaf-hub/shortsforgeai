@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
git push origin staging
git log --oneline remotes/origin/staging -3 > C:\Users\win\Downloads\shortsforgeai\staging_final_log.txt 2>&1
echo DONE >> C:\Users\win\Downloads\shortsforgeai\staging_final_log.txt
pause
