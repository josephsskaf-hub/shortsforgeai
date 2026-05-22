@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
if exist ".git\index.lock" del /f ".git\index.lock"
git checkout stage/render-v2 2>nul || git checkout -b stage/render-v2
git add app/(dashboard)/templates/TemplatesClient.tsx
git add app/(dashboard)/history/HistoryClient.tsx
git add app/(dashboard)/account/AccountClient.tsx
git add app/(dashboard)/thumbnail-generator/ThumbnailGeneratorClient.tsx
git commit -m "feat: dashboard UI/UX upgrade v2 — homepage-quality design on all pages (templates, history, account, thumbnail-gen)"
git push origin stage/render-v2
pause
