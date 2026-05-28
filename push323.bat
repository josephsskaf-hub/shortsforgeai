@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
del /f ".git\index.lock" 2>nul
git add "app/(dashboard)/history/HistoryClient.tsx"
git commit -m "Push #323: My Videos — video preview via preload=metadata; no more black cards"
git push origin main
pause
