@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #217 — Add NASA rocket clips to stockLibrary ===
echo Removing stale git lock if present...
if exist .git\index.lock del /f .git\index.lock
git add lib/stockLibrary.ts
git commit -m "Push #217 — Add NASA/SpaceX rocket clips to stockLibrary fallback pool

Root cause fix: CLIPS array had zero entries tagged with rocket/space/launch/nasa.
KEYWORD_TO_TAGS mapped rocket/spacex/starship to those tags, but no clip matched,
causing ALL rocket topics to fall back to Cloudinary sea turtle / elephant clips.

Added 5 NASA Public Domain clips from archive.org:
  - SpaceX Falcon 9 launch (KSC 2010, 512kb encode)
  - Space Shuttle launch MaxT opening (17s)
  - NASA Orion BFCR capsule footage (73s)
  - NASA SLS engine static fire test QM2 (17s)
  - NASA Orion Ascent Abort-2 test (60s, 1080p)

Tags: rocket, rocket_launch, launch, space, nasa, spacex, spacecraft, earth_orbit"
git push origin main
echo === Done! Push #217 deployed ===
pause
