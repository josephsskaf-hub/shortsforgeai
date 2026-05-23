@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #235 — Honor user [Pexels:] queries + script + speed verbatim ===
if exist .git\index.lock del /f .git\index.lock
git add lib/scriptParser.ts lib/pexels.ts lib/visualAssetCategories.ts app/api/generate-video-fast/route.ts app/api/compose/route.ts "app/(dashboard)/generate/GenerateClient.tsx"
git commit -m "Push #235 — Honor user [Pexels:] queries, verbatim narration & speed"
git push origin main
echo === Done! Push #235 deployed ===
pause
