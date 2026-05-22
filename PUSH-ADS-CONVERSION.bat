@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
git add app\(auth)\signup\page.tsx app\auth\callback\route.ts "app\(dashboard)\generate\GenerateClient.tsx"
git commit -m "feat: Google Ads conversion tracking on signup (push #188)"
git push origin main
pause
