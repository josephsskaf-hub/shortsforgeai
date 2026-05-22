@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git checkout stage/render-v2 2>nul || git checkout -b stage/render-v2
git add app/pricing/page.tsx
git add lib/openai.ts
git add lib/compose.ts
git commit -m "fix: rm Pexels from pricing + rm CTA voice from script prompts (no more Visit shortsforgeai.com in narration)"
git push origin stage/render-v2
pause
