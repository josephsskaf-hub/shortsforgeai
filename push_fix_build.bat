@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Git add ===
git add app/page.tsx lib/stripe.ts push_fix_build.bat
echo === Git commit ===
git commit -m "fix: add use client to home page - fix static generation timeout"
echo === Git push ===
git push origin main
echo === DONE === > push_result.txt
git log --oneline -3 >> push_result.txt
