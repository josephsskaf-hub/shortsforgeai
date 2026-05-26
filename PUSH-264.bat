@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add lib/visualAssetCategories.ts lib/runway.ts lib/compose.ts
git commit -m "feat(#264): 8 new visual categories for niche expansion — psychology_mindset, technology_ai, historical_war, nature_geography, health_body, crime_mystery, animal_wildlife added to VISUAL_CATEGORIES + detectVisualCategory + generateScenes prompt; also restore compose.ts truncation (was missing 185 lines)"
git push origin main
pause
