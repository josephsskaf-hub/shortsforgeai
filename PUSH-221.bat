@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #221 — Clean Step 2 Viral Score panel ===
if exist .git\index.lock del /f .git\index.lock
git add app/(dashboard)/generate/GenerateClient.tsx
git commit -m "Push #221 — Redesign ViralIntelligencePanel: score + 2 suggestions only

Removed: retention notes, thumbnail texts, opening caption, disclaimer, vi-grid
Added: large centered score, hook rating pill, max 2 improvement suggestion cards
Result: clean, minimal, gamified feel instead of wall of text"
git push origin main
echo === Done! Push #221 deployed ===
pause
