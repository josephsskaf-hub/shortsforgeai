@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
del /f /q .git\index.lock 2>nul
del /f /q .git\HEAD.lock 2>nul
del /f /q .git\refs\heads\main.lock 2>nul
git push origin a043622b6776b4d96bc62c6bc25e42cda9d402f4:refs/heads/main
echo.
echo === Push #290 (merge to main) complete ===
pause
