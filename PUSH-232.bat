@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #232 — Exit-intent survey popup ===
if exist .git\index.lock del /f .git\index.lock
git add app/HomePageClient.tsx app/api/exit-feedback/route.ts supabase/migrations/007_exit_feedback.sql
git commit -m "Push #232 — Exit-intent exit survey popup + /api/exit-feedback

Replaces the old 'free video' exit overlay with a why-are-you-leaving survey:
3 reason options + optional comment, POSTed to /api/exit-feedback (Supabase service role)
Triggers: desktop only (innerWidth>768), once per session (exitShown), after 5s dwell, mouse-leave top
Fade backdrop + slide-up card, dark/cyan/blur styling
New route app/api/exit-feedback writes to exit_feedback table; SQL in route comments + migration 007"
git push origin main
echo === Done! Push #232 deployed ===
pause
