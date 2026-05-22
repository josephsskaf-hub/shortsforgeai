@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: space/rocket visual keywords — ban 'screens/engineers' from Pexels queries, add rocket examples to generateScenes prompt, extend stockLibrary tags (push #210)"
git push origin main
pause
