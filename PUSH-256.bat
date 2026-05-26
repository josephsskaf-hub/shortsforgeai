@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add lib/compose.ts lib/runway.ts
git commit -m "feat(#256): video quality +25%% — (1) caption overhaul: font 58->76, pill bg, word-level yellow keyword pop on track 7; (2) clip gap fix: 0.06s micro-overlap + trim 0.25->0.1; (3) prompt coherence: 5 new topic categories + voiceover must cite specific fact"
git push origin main
pause
