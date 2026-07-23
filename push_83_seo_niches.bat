@echo off
cd /d "%~dp0"
echo ===== KINEO PUSH 83 (SEO niches) ===== > push_83_log.txt
git config user.email "josephsskaf@gmail.com" >> push_83_log.txt 2>&1
git config user.name "Joseph Skaf" >> push_83_log.txt 2>&1
git add -- "app/free-ai-shorts/[niche]/page.tsx" "push_83_seo_niches.bat" >> push_83_log.txt 2>&1
echo [staged] >> push_83_log.txt
git diff --cached --name-only >> push_83_log.txt 2>&1
echo [commit] >> push_83_log.txt
git commit -m "PUSH #83 add 8 high-intent SEO niche pages (stoicism, crypto, business, fitness, relationships, horror, celebrity, animals)" >> push_83_log.txt 2>&1
echo [push] >> push_83_log.txt
git push origin main >> push_83_log.txt 2>&1
git status --short --branch >> push_83_log.txt 2>&1
echo ===== FIM ===== >> push_83_log.txt
type push_83_log.txt
echo.
echo ============================================
echo  Terminou. Pode fechar.
echo ============================================
pause
