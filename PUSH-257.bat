@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add lib/visualAssetCategories.ts lib/runway.ts lib/compose.ts
git commit -m "fix(#257): b-roll portrait bug + keyword pop position — (1) add billionaire_wealth + money_finance categories to VISUAL_CATEGORIES with portrait/headshot rejection so beard/face shots never pass; (2) update detectVisualCategory to match wealth/finance topics; (3) update generateScenes prompt to assign correct category names instead of general_documentary; (4) move keyword pop y:64%%->69%% so it sits just above caption pill instead of floating mid-screen"
git push origin main
pause
