@echo off
cd /d C:\Users\win\Downloads\shortsforgeai
del /f .git\index.lock 2>nul
del /f .git\HEAD.lock 2>nul
git add -A
git commit -m "fix: Push #212 — Verified Visual Asset Whitelist (no toy rockets)

NEW: lib/visualAssetCategories.ts
- 17 topic categories: rocket_launch, booster_landing, mission_control, earth_orbit,
  spacecraft, pyramids, ancient_egypt, deep_ocean, underwater_science, underground_city,
  ancient_engineering, ancient_city, desert_ruins, dna_lab, mystery_document,
  library_archive, forensic_case
- Each category: ordered allowedQueries + negativeTerms + strictMode flag
- extractPexelsSlug(): parses Pexels page URL slug for metadata filtering
- isSlugRejected(): rejects clips if URL slug contains negative terms
- detectVisualCategory(): auto-detects category from stockSearchQuery + voiceover

REWRITE: lib/pexels.ts
- searchPexelsVideoObjects() returns full PexelsVideo objects (with .url field)
- searchAndFilter() tries query, inspects URL slug, rejects bad clips
- getPexelsVideoForScene() now takes 4 params (added voiceoverHint)
- Multi-query fallback: category allowedQueries -> stockSearchQuery -> keywords -> broad fallback
- Detailed [visual] logs: category, query, slug, accepted/rejected, reason
- Global space negative terms applied automatically for rocket/orbit/spacecraft categories

UPDATE: lib/runway.ts
- Scene interface: added visualCategory field (9th field)
- generateScenes(): updated system prompt to output visualCategory
- Parser: extracts visualCategory from GPT response, falls back to detectVisualCategory()
- All fallback/placeholder scenes now include auto-detected visualCategory

UPDATE: app/api/generate-video-fast/route.ts
- Passes scene.voiceover as 4th arg to getPexelsVideoForScene
- stockLibrary fallback uses visualCategory for smarter tag matching"
git push origin main
pause
