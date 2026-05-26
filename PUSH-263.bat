@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add lib/openai.ts lib/compose.ts
git commit -m "feat(#263): caption quality +15% — (1) CAPTION_SYNC_OFFSET 0.3->0.15s for tighter lip-sync; (2) caption chunk 7->5 words for faster Shorts pacing; (3) pickHighlightWord Pass 0: numbers/$/% get highest priority; (4) 15 new HIGHLIGHT_CANDIDATES (hundred/thousand/percent/brain/classified/etc)"
git push origin main
pause
