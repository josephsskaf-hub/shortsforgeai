@echo off
cd /d "%~dp0"
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
git add app/(dashboard)/admin/funnel/FunnelClient.tsx app/(dashboard)/admin/funnel/page.tsx app/api/admin/funnel/route.ts
git commit -m "feat(#254): rebuild admin funnel with real data — auth.users + profiles + videos; Growth / Subscribers / Video Activity / Conversion Rates sections"
git push origin main
pause
