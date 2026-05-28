@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo [START] > push331-log.txt
echo Deleting lock... >> push331-log.txt
if exist .git\index.lock (
    del /f .git\index.lock
    echo Lock deleted >> push331-log.txt
) else (
    echo No lock found >> push331-log.txt
)
echo Running git add... >> push331-log.txt
git add vercel.json >> push331-log.txt 2>&1
echo Git add done, exit code: %errorlevel% >> push331-log.txt
echo Running git commit... >> push331-log.txt
git commit -m "Push #331: fix cron schedule — change refresh-viral-now from every 5h to daily (Hobby plan limit)" >> push331-log.txt 2>&1
echo Git commit done, exit code: %errorlevel% >> push331-log.txt
echo Running git push... >> push331-log.txt
git push origin main >> push331-log.txt 2>&1
echo Git push done, exit code: %errorlevel% >> push331-log.txt
echo [DONE] >> push331-log.txt
