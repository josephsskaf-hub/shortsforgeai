@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/(dashboard)/admin/users/UsersClient.tsx
git commit -m "feat(#253): admin dashboard — Pro/Basic/Free subscriber cards + credit health alert; colored plan badges in table"
git push origin main
pause
