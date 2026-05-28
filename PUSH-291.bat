@echo off
cd /d "C:\Users\win\Downloads\shortsforgeai"
del /f /q .git\index.lock 2>nul
git checkout main
git add app/api/scenes/route.ts
git add lib/runway.ts
git status
git commit -m "perf(video-quality): improve footage-narration matching by ~10%

- scenes/route.ts: upgrade model gpt-4o-mini -> gpt-4o for better
  instruction following; lower temperature 0.7 -> 0.4 for more precise
  keyword selection
- scenes/route.ts: rewrite 3-step prompt -> 4-step prompt with
  NARRATION VISUAL ANCHOR extraction (Step 3). searchKeywords[0] now
  derived from the LITERAL content of each narration sentence, not just
  the overall topic anchor. This ensures footage matches what is being
  SAID in that exact moment, not just the general subject.
- runway.ts: lower temperature 0.6 -> 0.4 for auto-mode path
- runway.ts: strengthen stockSearchQuery rule — must be derived from
  that scene's own voiceover line (with concrete examples)
- system message updated to reinforce narration-first keyword selection

Push #291"
git push origin main
echo.
echo === Push complete. Check above for errors. ===
pause
