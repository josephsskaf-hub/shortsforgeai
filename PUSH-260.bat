@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/api/analyze-idea/route.ts
git commit -m "fix(#260): analyze-idea 504 — disable OpenAI SDK retries (maxRetries:0) so a slow response falls back instantly instead of retrying 2x and blowing past Vercel 60s limit"
git push origin main
pause
