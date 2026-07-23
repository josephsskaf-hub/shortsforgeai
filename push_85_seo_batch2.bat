@echo off
cd /d "%~dp0"
echo ===== KINEO PUSH 85 (SEO batch 2) ===== > push_85_log.txt
git config user.email "josephsskaf@gmail.com" >> push_85_log.txt 2>&1
git config user.name "Joseph Skaf" >> push_85_log.txt 2>&1
git add -- "app/free-ai-shorts/[niche]/page.tsx" "app/free-ai-shorts/page.tsx" "push_85_seo_batch2.bat" >> push_85_log.txt 2>&1
echo [staged] >> push_85_log.txt
git diff --cached --name-only >> push_85_log.txt 2>&1
echo [commit] >> push_85_log.txt
git commit -m "PUSH #85 add 6 more SEO niche pages (health, cars, gaming, movies, food, travel) = 28 total" >> push_85_log.txt 2>&1
echo [push] >> push_85_log.txt
git push origin main >> push_85_log.txt 2>&1
git status --short --branch >> push_85_log.txt 2>&1
echo ===== FIM ===== >> push_85_log.txt
type push_85_log.txt
echo.
echo ====== Terminou. Pode fechar. ======
pause
