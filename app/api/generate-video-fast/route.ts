import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, shortCaptionFromVoiceover } from '@/lib/runway'
import type { Scene } from '@/lib/runway'
import { getPexelsVideoForScene, getPexelsVideoForExactQuery, getPexelsVideoForQueries } from '@/lib/pexels'
import { pickLibraryClips } from '@/lib/stockLibrary'
import { ensureAccessibleUrl } from '@/lib/videoCache'
import { parseUserScript } from '@/lib/scriptParser'

export const maxDuration = 60

// Push #084 — Fast Mode: cheap stock-footage + TTS pipeline.
//
// This endpoint mirrors /api/generate-video's request shape but skips
// Runway entirely. For each generated scene description it picks a
// portrait HD clip from Pexels (with the curated stockLibrary as a
// safety net), then returns clip URLs synchronously — the client jumps
// straight to /api/compose without polling. Target unit cost is
// ~$0.01-0.05 per video.

// Push #208 — removed 30s option, added 90s. 30s replaced by 45s minimum.
const SUPPORTED_DURATIONS = [45, 60, 90] as const
type Duration = (typeof SUPPORTED_DURATIONS)[number]

// Fast Mode credit cost. Kept low on purpose — Pexels search is free
// and TTS + Creatomate are the only paid pieces.
const FAST_MODE_CREDIT_COST = 1

function clipCountForDuration(d: Duration): number {
  // Stock clips are usually >10s, but we still ask for N distinct clips so
  // Creatomate has variety. We cap at 9 to support 90s videos.
  return Math.max(2, Math.min(9, Math.ceil(d / 10)))
}

// Push #349 — B-roll relevance fallback. When a scene's Pexels search comes up
// empty (or only returns a clip already used), a REPEATED RELEVANT clip beats a
// FRESH IRRELEVANT one. This walks backwards through the clips already placed
// and returns the most recent real Pexels-sourced clip (cached to Supabase, or
// a raw pexels.com URL when caching was skipped). Curated stockLibrary fallbacks
// (Cloudinary/archive.org) are intentionally skipped — they're generic filler,
// not topic-matched footage, so we never "extend" into them.
function findPreviousRelevantClip(
  clipUrls: string[],
  usedPexelsUrls: Set<string>,
  currentIdx: number,
): string | null {
  for (let i = clipUrls.length - 1; i >= 0; i--) {
    const url = clipUrls[i]
    if (url && (url.includes('supabase') || url.includes('pexels'))) {
      return url
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[generate-fast] OPENAI_API_KEY is not configured')
      return NextResponse.json(
        { error: 'AI service is not configured. Please contact support.' },
        { status: 500 }
      )
    }
    // Push #087 — fail fast if the downstream renderer isn't configured.
    // /api/compose will hard-error on this same check; surfacing it here
    // saves an OpenAI scene-generation call for a job we can't finish.
    if (!process.env.CREATOMATE_API_KEY) {
      console.error('[generate-fast] CREATOMATE_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Video assembly is not configured — please contact support.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to generate a video.' },
        { status: 401 }
      )
    }

    // Push #346 — accept brollQueries from the BrollPlan (v3.0 Phase 1).
    // When the client ran generate-broll-plan first (Creator Mode or Autopilot
    // background fetch), the BrollPlan's AI-directed pexelsQuery values are
    // passed here so every scene gets a specific, topic-matched stock search
    // instead of the generic GPT scene description.
    // Push #349 — `brollScenes` carries the full per-scene metadata from the
    // BrollPlan (multi-query list, relevance score, planned duration). It
    // supersedes `brollQueries` (single query per scene), which is kept for
    // backward compat with older clients that only sent one query.
    let body: {
      prompt?: string
      duration?: number
      language?: string
      brollQueries?: Array<{ sceneNumber: number; pexelsQuery: string }>
      brollScenes?: Array<{
        sceneNumber: number
        pexelsQuery?: string
        pexelsQueries?: string[]
        relevanceScore?: number
        durationSeconds?: number
        scenePurpose?: string
      }>
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
    }
    if (prompt.length > 5000) {
      return NextResponse.json({ error: 'Prompt is too long (5000 chars max).' }, { status: 400 })
    }

    const requestedDuration = Number(body.duration) || 45
    const duration: Duration = SUPPORTED_DURATIONS.includes(requestedDuration as Duration)
      ? (requestedDuration as Duration)
      : 45

    const clipCount = clipCountForDuration(duration)

    // v3.0 Phase 1: BrollPlan query map — keyed by 1-based sceneNumber.
    // When provided, these AI-directed queries replace the generic GPT scene
    // queries for Pexels searches, giving each scene highly specific footage.
    const brollQueryMap = new Map<number, string>()

    // Push #349 — richer per-scene metadata map. Holds the multi-query list,
    // relevance score and planned duration so the clip loop can run the
    // relevance-aware fallback hierarchy. Keyed by 1-based sceneNumber.
    type BrollSceneMeta = {
      pexelsQuery?: string
      pexelsQueries?: string[]
      relevanceScore?: number
      durationSeconds?: number
      scenePurpose?: string
    }
    const brollSceneMap = new Map<number, BrollSceneMeta>()

    if (Array.isArray(body.brollScenes)) {
      for (const entry of body.brollScenes) {
        if (typeof entry.sceneNumber !== 'number') continue
        const queries = Array.isArray(entry.pexelsQueries)
          ? entry.pexelsQueries
              .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
              .map((q) => q.trim())
          : []
        const single =
          typeof entry.pexelsQuery === 'string' && entry.pexelsQuery.trim()
            ? entry.pexelsQuery.trim()
            : queries[0]
        brollSceneMap.set(entry.sceneNumber, {
          pexelsQuery: single,
          pexelsQueries: queries.length > 0 ? queries : single ? [single] : undefined,
          relevanceScore: typeof entry.relevanceScore === 'number' ? entry.relevanceScore : undefined,
          durationSeconds: typeof entry.durationSeconds === 'number' ? entry.durationSeconds : undefined,
          scenePurpose: typeof entry.scenePurpose === 'string' ? entry.scenePurpose : undefined,
        })
        if (single) brollQueryMap.set(entry.sceneNumber, single)
      }
    }

    // Backward compat: `brollQueries` (single query per scene). Only fills gaps
    // not already covered by the richer `brollScenes` map above.
    if (Array.isArray(body.brollQueries)) {
      for (const entry of body.brollQueries) {
        if (
          typeof entry.sceneNumber === 'number' &&
          typeof entry.pexelsQuery === 'string' &&
          entry.pexelsQuery.trim() &&
          !brollQueryMap.has(entry.sceneNumber)
        ) {
          brollQueryMap.set(entry.sceneNumber, entry.pexelsQuery.trim())
        }
      }
    }

    if (brollQueryMap.size > 0) {
      console.log(
        `[generate-fast] BrollPlan active: ${brollQueryMap.size} AI-directed scene queries (${brollSceneMap.size} with full metadata)`,
      )
    }

    // Upfront credit balance check. Deduction happens in /api/compose/status
    // when the final mp4 succeeds.
    {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('video_credits')
        .eq('id', user.id)
        .single()
      if (profileErr && profileErr.code !== 'PGRST116') {
        console.error('[generate-fast] credit balance fetch failed:', profileErr.message)
      }
      const balance = profile?.video_credits ?? 0
      if (balance < FAST_MODE_CREDIT_COST) {
        return NextResponse.json(
          { error: 'Not enough credits.', needed: FAST_MODE_CREDIT_COST, balance },
          { status: 402 }
        )
      }
    }

    // Push #235 — Verbatim mode. If the user authored the script with explicit
    // `[Pexels: QUERY]` markers, honor them literally: each marker becomes a
    // scene whose footage query and spoken line come straight from the user.
    // We do NOT send the script to GPT in this case — the whole point is that
    // the user already chose the perfect clip and wrote the exact narration.
    const parsedScript = parseUserScript(prompt)
    const verbatim = parsedScript.hasMarkers && parsedScript.segments.length > 0

    // Step 1 — Build scenes.
    //   - Verbatim: one scene per [Pexels: ...] marker, query + narration as-is.
    //   - Otherwise: GPT plans scenes (each with a cinematic description and
    //     topic-specific Pexels keywords). Push #235 widened the prompt window
    //     from 400 → 1200 chars so longer briefs keep their topic fidelity.
    let scenes: Scene[]
    if (verbatim) {
      scenes = parsedScript.segments.slice(0, 12).map((seg) => ({
        description: seg.pexelsQuery,
        searchKeywords: seg.pexelsQuery,
        stockSearchQuery: seg.pexelsQuery,
        negativeVisualPrompt: '',
        scenePurpose: 'EXPLANATION',
        visualIntent: 'User-specified footage',
        visualCategory: 'general_documentary',
        voiceover: seg.voiceover,
        caption: shortCaptionFromVoiceover(seg.voiceover || seg.pexelsQuery),
      }))
      console.log(
        `[generate-fast] VERBATIM mode: ${scenes.length} user-specified clip(s); speed=${parsedScript.speed ?? 'default'}`,
      )
    } else {
      try {
        scenes = await generateScenes(prompt.slice(0, 1200), clipCount)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[generate-fast] scene generation failed:', msg)
        return NextResponse.json(
          { error: 'Failed to plan scenes. Please try a different prompt.' },
          { status: 500 }
        )
      }
    }

    // Step 2 — Resolve each scene to a clip URL.
    //
    // Push #215 — Removed STOCKLIB_PRIORITY mode (Push #213/214).
    // Root cause: ALL Pexels CDN URLs (videos.pexels.com/video-files/...) return
    // HTTP 403 when Creatomate fetches them server-side. NASA SVS also 403s.
    // The only stockLibrary URLs that work server-side are Cloudinary demo.
    // Priority mode was forcing broken URLs → always 403 for rocket topics.
    //
    // Fix: always try Pexels API first (PEXELS_API_KEY must be set in Vercel
    // for this to return real results). The visual category + slug filter from
    // Push #212 (pexels.ts) still applies to reject abstract/wrong footage.
    // Fallback: stockLibrary (Cloudinary demo clips — wrong content but renders).

    // Push #295 — switched from Promise.all to sequential to enable cross-scene
    // deduplication. Two bugs fixed here:
    //
    // Bug 1 (wrong clips): libQuery was built from visualCategory name
    // (e.g. "general documentary") instead of the GPT-generated stockSearchQuery
    // (e.g. "Nazi soldiers WW2 Europe invasion"). Fixed: stockSearchQuery is now
    // the primary source, with searchKeywords and description as fallbacks.
    //
    // Bug 2 (repeated clips): Promise.all ran all Pexels fetches concurrently
    // with no dedup — the same top-ranking URL came back for similar queries.
    // Fixed: usedPexelsUrls Set tracks every raw Pexels URL already assigned;
    // if a duplicate is returned we skip Pexels and use stockLibrary instead
    // (which uses idx as a seed, so each scene gets a different library clip).
    const usedPexelsUrls = new Set<string>()
    const clipUrls: string[] = []

    for (let idx = 0; idx < scenes.length; idx++) {
      const scene = scenes[idx]
      const cat = scene.visualCategory ?? ''
      const sceneNo = idx + 1

      // Push #349 — pull this scene's BrollPlan metadata (1-based sceneNumber).
      const brollMeta = brollSceneMap.get(sceneNo)
      // v3.0 Phase 1: if a BrollPlan provided a specific AI-directed pexelsQuery
      // for this scene, use it as the primary search — it's far more specific
      // (e.g. "Wall Street trading floor 1987 crash") than GPT's generic scene
      // description.
      const brollOverride = brollQueryMap.get(sceneNo)
      const relevanceScore = brollMeta?.relevanceScore
      const purpose = (brollMeta?.scenePurpose ?? scene.scenePurpose ?? '').toString()
      const durationSeconds = brollMeta?.durationSeconds
      const scoreLabel = typeof relevanceScore === 'number' ? String(relevanceScore) : 'n/a'
      const durLabel = typeof durationSeconds === 'number' ? `${durationSeconds}` : '?'

      // Push #349 — Timeline balancing. A tiny trailing gap (<3s) isn't worth a
      // fresh Pexels search (and a brand-new clip flashing for under 3 seconds
      // looks jarring) — just extend whatever clip preceded it so the timeline
      // stays full and visually coherent. Only fires when we know the planned
      // duration (BrollPlan metadata present) and there is a prior clip.
      if (typeof durationSeconds === 'number' && durationSeconds < 3 && clipUrls.length > 0) {
        const prevUrl = clipUrls[clipUrls.length - 1]
        clipUrls.push(prevUrl)
        console.log(
          `[clip] scene=${sceneNo} purpose=${purpose} duration=${durLabel}s query="(gap)" source=FALLBACK-A score=${scoreLabel} GAP<3s url=${prevUrl.slice(0, 60)}`,
        )
        continue
      }

      // Bug 1 fix (#295): prefer GPT's specific stockSearchQuery over the generic
      // visual category name. Falls back to searchKeywords, then description.
      // v3.0: BrollPlan override takes priority over all other sources.
      const libQuery = brollOverride ||
        scene.stockSearchQuery ||
        scene.searchKeywords ||
        (cat && cat !== 'general_documentary' ? cat.replace(/_/g, ' ') : scene.description)

      // Final fallback: stockLibrary (Cloudinary demo — always server-accessible)
      // In verbatim mode the user's own query routes the fallback too, so even
      // the safety net stays on-topic.
      const lib = pickLibraryClips(verbatim ? scene.stockSearchQuery : libQuery, 1, idx)
      const fallbackUrl = lib[0]?.url ?? ''

      // Push #349 — multi-query support. When the BrollPlan supplies an ordered
      // list of queries (most specific first), try them all via the multi-query
      // helper so the scene keeps its most-relevant footage and only broadens
      // when the specific term has no inventory.
      const brollQueries = brollMeta?.pexelsQueries ?? (brollOverride ? [brollOverride] : null)

      // Try Pexels API first (requires PEXELS_API_KEY env var).
      // Push #216 — Pexels CDN URLs are proxied through Supabase Storage so
      // Creatomate can download them. ensureAccessibleUrl() downloads the clip
      // from Pexels server-side (our Vercel is authorized) and caches it in
      // the "stock-videos" Supabase bucket, then returns the public Supabase URL.
      //
      // Push #235 — verbatim mode searches the user's EXACT query directly,
      // bypassing the category allowedQueries override. Non-verbatim keeps the
      // GPT/category path. v3.0: BrollPlan override → exact query, same path.
      let rawPexelsUrl: string | null
      let primarySource: string
      let queryUsed: string
      if (brollQueries && brollQueries.length > 0) {
        rawPexelsUrl = await getPexelsVideoForQueries(brollQueries, scene.voiceover)
        primarySource = 'BROLLPLAN'
        queryUsed = brollQueries[0]
      } else if (verbatim) {
        rawPexelsUrl = await getPexelsVideoForExactQuery(scene.stockSearchQuery)
        primarySource = 'VERBATIM'
        queryUsed = scene.stockSearchQuery
      } else {
        rawPexelsUrl = await getPexelsVideoForScene(
          scene.searchKeywords,
          scene.description,
          scene.stockSearchQuery,
          scene.voiceover,
        )
        primarySource = 'PEXELS'
        queryUsed = libQuery
      }

      // Bug 2 fix (#295): skip a Pexels URL already used by a prior scene.
      const isDuplicate = !!rawPexelsUrl && usedPexelsUrls.has(rawPexelsUrl)
      const pexelsUrl = rawPexelsUrl && !isDuplicate ? rawPexelsUrl : null

      if (pexelsUrl) {
        usedPexelsUrls.add(pexelsUrl)
        const cachedUrl = await ensureAccessibleUrl(pexelsUrl, fallbackUrl)
        clipUrls.push(cachedUrl)

        // Push #349 — relevance threshold. Pexels is the only REAL footage
        // source, so we never reject a Pexels clip on score alone — but a
        // sub-75 score means the AI flagged a weak match, so log it loudly for
        // debugging from server logs.
        if (typeof relevanceScore === 'number' && relevanceScore < 75) {
          console.warn(
            `[clip] scene=${sceneNo} LOW-RELEVANCE score=${relevanceScore} — keeping Pexels clip (only real footage source)`,
          )
        }
        console.log(
          `[clip] scene=${sceneNo} purpose=${purpose} duration=${durLabel}s query="${queryUsed.slice(0, 60)}" source=${primarySource} score=${scoreLabel} url=${cachedUrl.slice(0, 60)}`,
        )
        continue
      }

      // Pexels returned nothing usable (no result, or a duplicate of an earlier
      // scene). Enter the smart fallback hierarchy.
      if (isDuplicate) {
        console.log(`[clip] scene=${sceneNo} DEDUP — pexels url already used, entering fallback`)
      }

      // Fallback A: extend the most recent real (Pexels-sourced) clip. A repeated
      // RELEVANT clip beats a fresh IRRELEVANT stockLibrary clip — this is also
      // what we want when relevanceScore < 60 (the curated clip is very unlikely
      // to match an already-weak scene).
      const previousRelevantUrl = findPreviousRelevantClip(clipUrls, usedPexelsUrls, idx)

      // Fallback B: stockLibrary (Cloudinary demo). Only when there is no prior
      // relevant clip to extend.
      const libUrl = previousRelevantUrl ?? fallbackUrl

      if (libUrl) {
        const fbSource = previousRelevantUrl ? 'FALLBACK-A' : 'FALLBACK-B'
        if (previousRelevantUrl) {
          console.log(`[clip] scene=${sceneNo} FALLBACK-A: extending previous relevant clip`)
        } else {
          console.log(`[clip] scene=${sceneNo} FALLBACK-B: stockLibrary url=${fallbackUrl.slice(0, 60)}`)
        }
        console.log(
          `[clip] scene=${sceneNo} purpose=${purpose} duration=${durLabel}s query="${queryUsed.slice(0, 60)}" source=${fbSource} score=${scoreLabel} url=${libUrl.slice(0, 60)}`,
        )
        clipUrls.push(libUrl)
      } else {
        // Absolute last resort — no prior clip AND no stockLibrary match. Push
        // the (empty) fallback; it is filtered out below.
        console.log(
          `[clip] scene=${sceneNo} purpose=${purpose} duration=${durLabel}s query="${queryUsed.slice(0, 60)}" source=STOCKLIB score=${scoreLabel} url=(none)`,
        )
        clipUrls.push(fallbackUrl)
      }
    }

    const filtered = clipUrls.filter((u) => typeof u === 'string' && u.length > 0)
    if (filtered.length === 0) {
      return NextResponse.json(
        { error: 'No stock footage could be sourced. Please try a different topic.' },
        { status: 502 }
      )
    }

    const generationId = randomUUID()

    // Push #132 — assemble the caption/voiceover pipeline. Each scene now
    // carries the SAME source string for both: the per-scene `voiceover` is
    // the narration TTS will read, and the per-scene `caption` is its
    // ≤8-word readable on-screen paraphrase. We log both so any future
    // drift between captions and narration is debuggable from server logs.
    const sceneCaptions = scenes.map((s) => s.caption)
    // Push #235 — in verbatim mode the spoken text is the user's own narration
    // (markers/directives already stripped by the parser). Prefer it so what is
    // narrated is exactly what the user wrote; otherwise join the scene lines.
    const sceneJoinedVoiceover = scenes
      .map((s) => s.voiceover)
      .filter((v) => typeof v === 'string' && v.trim().length > 0)
      .join(' ')
    const voiceoverScript =
      verbatim && parsedScript.narration ? parsedScript.narration : sceneJoinedVoiceover

    console.log(
      '[generate-fast] scenes:',
      JSON.stringify(
        scenes.map((s, i) => ({
          scene: i + 1,
          voiceover: s.voiceover,
          caption: s.caption,
        })),
      ),
    )

    console.log(
      `[generate-fast] OK user=${user.id.slice(0, 8)} clips=${filtered.length} duration=${duration}s captions=${sceneCaptions.length}`
    )

    // Client expects `scenes` to be a string array of descriptions for the
    // result-page recap UI — flatten before serializing. We also surface
    // `scene_captions` and `voiceover_script` so the compose request can
    // be assembled with the per-scene caption pipeline as the single source
    // of truth.
    return NextResponse.json({
      mode: 'fast',
      generationId,
      prompt,
      duration,
      scenes: scenes.map((s) => s.description), // client still gets string array
      scene_captions: sceneCaptions,
      voiceover_script: voiceoverScript,
      clip_urls: filtered,
      // Push #235 — when the user authored the script verbatim, tell the client
      // so it forwards this narration (not the analyze-idea brief) and the
      // requested TTS speed to /api/compose.
      verbatim,
      speed: parsedScript.speed,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-fast] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
