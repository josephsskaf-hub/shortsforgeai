@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git add app/HomePageClient.tsx
git add app/(dashboard)/my-videos/MyVideosClient.tsx
git add app/api/compose/status/[renderId]/route.ts
git add components/Sidebar.tsx
git add components/TopBar.tsx
git add app/(dashboard)/create/CreateClient.tsx
git add app/(dashboard)/dashboard/DashboardClient.tsx
git add app/(dashboard)/generate/GenerateClient.tsx
git commit -m "fix: restore all truncated files + autoplay homepage videos + My Videos 5-col grid + clean titles"
git push origin main
pause
