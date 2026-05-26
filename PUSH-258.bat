@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add lib/compose.ts app/api/compose/route.ts app/api/admin/funnel/route.ts "app/(dashboard)/admin/funnel/FunnelClient.tsx"
git commit -m "fix(#258): caption drift + payment funnel — (1) build captions DIRECTLY from Whisper words (no script-word-count mapping) so numbers like 63%% never cause desync; (2) fix transcribeTTS using openai toFile instead of new File() for Node.js 18 compat; (3) add Stripe checkout funnel to admin: sessions created/completed/abandoned + conversion rate + failed payments"
git push origin main
pause
