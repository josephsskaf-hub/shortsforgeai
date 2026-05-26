@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/(dashboard)/admin/users/UsersClient.tsx
git commit -m "feat(#255): admin users — paid subscribers spotlight table with credits, Pro first, color-coded credit balance"
git push origin main
pause
