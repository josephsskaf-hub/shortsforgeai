@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
echo === Push #219 — Fix bad NASA clips in stockLibrary ===
if exist .git\index.lock del /f .git\index.lock
git add lib/stockLibrary.ts
git commit -m "Push #219 — Remove candle-looking static fire clip, add better launch footage

Removed: ACM_Static_test_QM2 (SLS static fire filmed from below = looks like candle)
Removed: 2015-00153_Orion_BFCR_PT2_RELEASE (internal review reel, not a launch)
Removed: Ascent-Abort-2-1080 (abort test, capsule separation looks weird)
Added: Ares1-xTestRocketLaunches/ksc_102909_aresIx_launch_1080.mp4 (Ares I-X liftoff)
Added: NASAKennedy-4vkqBfv8OMM (Launch of SpaceX Falcon 9, 720p)
Added: NASAKennedy-RxFwUG9PiYM (STS-133 Space Shuttle launch, 720p)

Root cause: ground-level static fire tests show only flames/nozzle, not rocket ascending.
Replaced with clips that visually show rocket lifting off/ascending.
All new URLs verified 206 on direct GET with no auth (Creatomate-compatible)."
git push origin main
echo === Done! Push #219 deployed ===
pause
