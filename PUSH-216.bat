@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: push 216 cache Pexels clips in Supabase storage so Creatomate can download them"
git push origin main
pause
