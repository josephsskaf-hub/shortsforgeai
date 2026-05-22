@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "feat: Push #211 — Creative Director Engine (gpt-4o, 8-field scenes, premium Pexels queries)

- Upgrade generateScenes() from gpt-4o-mini to gpt-4o
- New 8-field Scene schema: stockSearchQuery, negativeVisualPrompt, scenePurpose, visualIntent
- Topic-specific visual rules for space/rockets, history, ocean, money, tech
- Per-topic negativeVisualPrompt to block wrong footage (cartoon, mission control, etc.)
- stockSearchQuery used as primary Pexels search (e.g. 'Falcon 9 rocket launch fire night slow motion')
- max_tokens 800->1800, temperature 0.7->0.6 for more precise creative direction
- getPexelsVideoForScene() accepts optional 3rd param stockSearchQuery
- generate-video-fast/route.ts passes scene.stockSearchQuery to Pexels helper
- Pexels logs full query trace for debugging"
git push origin main
pause
