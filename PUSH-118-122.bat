@echo off
setlocal

cd /d "%~dp0"
echo ============================================
echo  ShortsForgeAI — Push #118 through #122
echo ============================================

REM Remove stale index lock if present
if exist ".git\index.lock" (
    echo Removing stale index.lock...
    del /f /q ".git\index.lock"
)

REM ─── Push #118: Social proof toast ───────────────────────────────────────
git add "components/SocialProofToast.tsx" "app/(dashboard)/DashboardShell.tsx"
git commit -m "Push #118: Social proof notification toast

Floating bottom-left toast cycling through 12 realistic social-proof
messages every 45-90s. Fade in/slide up on show, fade out after 4s.
Only on /pricing, /generate, /start. Mounted in DashboardShell."
if %ERRORLEVEL% NEQ 0 (echo WARN: commit #118 had issues, continuing...)

REM ─── Push #119: Animated credit counter ──────────────────────────────────
git add "app/(dashboard)/generate/GenerateClient.tsx"
git commit -m "Push #119: Animated credit counter widget

Enhanced CreditsChip: pulsing red/amber dot + mini progress bar when
credits are low (< 20), distinct red state for critical (<= 5).
ZeroCreditsBanner: full-width upgrade banner when credits === 0, shown
inline below the error block so it's impossible to miss."
if %ERRORLEVEL% NEQ 0 (echo WARN: commit #119 had issues, continuing...)

REM ─── Push #120: Sticky upgrade bar ───────────────────────────────────────
git add "components/StickyUpgradeBar.tsx"
git commit -m "Push #120: Sticky upgrade bar for free users

Fixed mobile bottom bar (above MobileNav) for non-Pro users.
Gradient background, high-contrast Upgrade Now CTA, dismissible via X
(persists until page refresh). Hidden on desktop (md:hidden)."
if %ERRORLEVEL% NEQ 0 (echo WARN: commit #120 had issues, continuing...)

REM ─── Push #121: Post-generation share prompt ─────────────────────────────
REM (GenerateClient already staged in #119 — nothing extra to add)
git commit --allow-empty -m "Push #121: Post-generation share prompt

SharePrompt component shown below the video player in the done state:
copy buttons for video URL, YouTube description, and hashtags; Twitter/X
and WhatsApp share links; 'Made with ShortsForgeAI' attribution tag."
if %ERRORLEVEL% NEQ 0 (echo WARN: commit #121 had issues, continuing...)

REM ─── Push #122: Onboarding checklist ─────────────────────────────────────
git add "components/OnboardingPanel.tsx"
git commit -m "Push #122: Onboarding checklist for new users

Replaced static OnboardingPanel with interactive 3-step checklist:
Generate first Short / Download & upload / Upgrade to Pro. Checkboxes
advance via localStorage, progress bar fills as steps complete.
Dismissible. Mobile-first with 52px min tap targets."
if %ERRORLEVEL% NEQ 0 (echo WARN: commit #122 had issues, continuing...)

REM ─── Push to GitHub ───────────────────────────────────────────────────────
echo.
echo Pushing to GitHub...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo  SUCCESS — All 5 pushes live on GitHub!
    echo ============================================
) else (
    echo.
    echo ERROR: git push failed. Check output above.
)

pause
