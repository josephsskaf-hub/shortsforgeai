import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, shortCaptionFromVoiceover } from '@/lib/runway'
import type { Scene } from '@/lib/runway'
// Push #351 — Pexels import removed. All Pexels API calls disabled.
// import { getPexelsVideoForScene, getPexelsVideoForExactQuery, getPexelsVideoForQueries } from '@/lib/pexels'
// Push #353 — Pixabay replaces Pexels as primary B-roll source.
// Fast Mode v2 (02/07) — getPixabayClipsForScene returns a RANKED mini-pool per scene.
import { getPixabayClipsForScene } from '@/lib/pixabay'
import { pickLibraryClips, type LibraryClip } from '@/lib/stockLibrary'
// Push #351 — ensureAccessibleUrl removed (was only used for Pexels CDN proxying; Pexels now OFF).
// import { ensureAccessibleUrl } from '@/lib/videoCache'
import { parseUserScript } from '@/lib/scriptParser'

// HOTFIX (02/07) — Fast Mode v2 blew the default 60s budget on 60s scripts
// (6-9 scenes × multi-pool Pixabay sourcing → Vercel 504 "Task timed out").
// Account is Pro, so 120s is allowed. Paired with the pool short-circuit in
// lib/pixabay.ts (getPixabayClipsForScene) that removes the tripled API calls.
export const maxDuration = 120

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

// Push #434 — Fast Mode is FREE (0 credits) as a top-of-funnel growth engine.
// Pexels is free; only TTS + Creatomate cost cents per video. Free-plan Fast
// videos are watermarked (server-side in /api/compose) so each one markets us.
const FAST_MODE_CREDIT_COST = 0

// Fast Mode v2 (02/07) — RITMO: source 2 ranked clips per scene so compose can
// cut every ~2.5-4s inside a scene instead of holding one static clip for 6-9s.
const FAST_CLIPS_PER_SCENE = 2
// Sanity cap on total clip elements per video (12 verbatim scenes × 2 = 24 is too many).
const FAST_MAX_TOTAL_CLIPS = 16

function clipCountForDuration(d: Duration): number {
  // Stock clips are usually >10s, but we still ask for N distinct clips so
  // Creatomate has variety. We cap at 9 to support 90s videos.
  return Math.max(2, Math.min(9, Math.ceil(d / 10)))
}

// Push #350 — People/lifestyle keyword detector for FALLBACK-B stock filter.
// When a scene has no people/lifestyle vocabulary in its narration or description,
// we strip any stock clips that carry those tags before using them as fallback.
// This prevents a "beanie-guy in front of a mural" from appearing in an Amy
// Bradley mystery video just because it was the top rotation clip.
const PEOPLE_LIFESTYLE_RE = /\b(people|person|lifestyle|portrait|fashion|influencer|teenager|teen|walking|smiling|model|woman|man|girl|boy|human)\b/i

function sceneHasPeopleVocabulary(voiceover: string, description: string, keywords: string): boolean {
  return (
    PEOPLE_LIFESTYLE_RE.test(voiceover) ||
    PEOPLE_LIFESTYLE_RE.test(description) ||
    PEOPLE_LIFESTYLE_RE.test(keywords)
  )
}

// Push #349 — B-roll relevance fallback. Repeat a relevant clip rather than
// show a fresh irrelevant one.
// Push #351 — updated to accept ANY previous valid URL. Since Pexels is now
// disabled, previous clips are stockLibrary (Cloudinary) and FALLBACK-A must
// be able to extend them for timeline coherence.
// Push #352 — Intelligent cycling. Instead of always returning the most-recent
// clip (causing scenes 3–5 to repeat the same clip linearly), collect all valid
// clips already in the timeline and cycle through them using currentIdx as the
// cycle position. Pattern for a 5-scene video with 2 valid clips:
//   scene2→clip0, scene3→clip1, scene4→clip0, scene5→clip1
// Guarantees visual variety in long videos without any external API call.
function findPreviousRelevantClip(
  clipUrls: string[],
  usedPexelsUrls: Set<string>,
  currentIdx: number,
): string | null {
  const validClips = clipUrls.filter(url => url && url.length > 0)
  if (validClips.length === 0) return null
  return validClips[currentIdx % validClips.length]
}

// Push #486 (03/07) — CONTENT-BASED scene↔plan alignment.
// Bug (confirmed twice in prod runtime logs 01-02/07): the BrollPlan splits the
// script its own way (e.g. 7 scenes incl. hook) while generateScenes() plans
// clipCount scenes (e.g. 5). The old index-by-index lookup
// (brollSceneMap.get(idx+1)) shifted EVERY query from scene 2 onward — the
// "1968 drought" scene got its neighbour's "lake aerial view" query.
// Fix: when plan/scene counts DIFFER, match each GPT scene to the plan scene
// whose NARRATION shares the most meaningful tokens with the scene's voiceover.
// When narration isn't available (older clients), fall back to PROPORTIONAL
// position mapping — still strictly better than raw-index when counts differ.
// When counts MATCH, the direct 1:1 mapping is kept (happy path unchanged).
const ALIGN_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'and', 'or', 'is', 'are', 'was', 'were',
  'it', 'its', 'this', 'that', 'these', 'those', 'with', 'for', 'from', 'by', 'as', 'but',
  'not', 'no', 'they', 'their', 'you', 'your', 'he', 'she', 'his', 'her', 'has', 'have',
  'had', 'be', 'been', 'will', 'would', 'can', 'could', 'into', 'than', 'then', 'there',
  'here', 'what', 'when', 'where', 'who', 'how', 'why', 'also', 'just', 'still', 'over',
  'under', 'about', 'after', 'before', 'more', 'most', 'so', 'if', 'we', 'our', 'us',
  'one', 'two', 'do', 'does', 'did', 'them', 'all', 'out', 'up', 'down', 'only', 'even',
])

function alignTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !ALIGN_STOPWORDS.has(t)),
  )
}

function alignOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared++
  return shared / Math.min(a.size, b.size)
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
        requiresExtension?: boolean
        // Push #486 — the plan scene's narration text, used for CONTENT-BASED
        // scene↔plan alignment (see buildAlignedBrollMeta below).
        narration?: string
      }>
      // #358 — instrumentation: client forwards whether the BrollPlan came back
      // degraded (GPT failed) so we can log/record the reason for VERBATIM.
      brollDegraded?: boolean
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
      /** When true, skip Pexels entirely and extend the previous relevant clip. */
      requiresExtension?: boolean
      /** Push #486 — plan scene narration for content-based alignment. */
      narration?: string
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
          requiresExtension: entry.requiresExtension === true,
          narration: typeof entry.narration === 'string' && entry.narration.trim() ? entry.narration.trim() : undefined,
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
          // Push #486 — mirror into brollSceneMap so the alignment pass (which
          // reads only brollSceneMap) also covers brollQueries-only clients.
          if (!brollSceneMap.has(entry.sceneNumber)) {
            const q = entry.pexelsQuery.trim()
            brollSceneMap.set(entry.sceneNumber, { pexelsQuery: q, pexelsQueries: [q] })
          }
        }
      }
    }

    if (brollQueryMap.size > 0) {
      console.log(
        `[generate-fast] BrollPlan active: ${brollQueryMap.size} AI-directed scene queries (${brollSceneMap.size} with full metadata)`,
      )
    }

    // Push #434 — Fast Mode is now FREE + unlimited (growth engine). No credit
    // gate: any logged-in user can generate Fast. Free-plan Fast videos are
    // watermarked server-side in /api/compose so each one markets the product;
    // removing the watermark + the AI engine are the paid upgrades.
    // (Credit balance is no longer required for Fast; AI Generated still costs 30.)

    // Push #235 — Verbatim mode. If the user authored the script with explicit
    // `[Pexels: QUERY]` markers, honor them literally: each marker becomes a
    // scene whose footage query and spoken line come straight from the user.
    // We do NOT send the script to GPT in this case — the whole point is that
    // the user already chose the perfect clip and wrote the exact narration.
    const parsedScript = parseUserScript(prompt)
    const verbatim = parsedScript.hasMarkers && parsedScript.segments.length > 0

    // #358 — instrumentation: record WHY this generation uses VERBATIM (and
    // whether the upstream BrollPlan was degraded). degradedReason is persisted
    // to broll_metrics below.
    const brollDegraded = body.brollDegraded === true
    const degradedReason: string | null = brollDegraded
      ? 'plan_degraded'
      : verbatim
        ? (parsedScript.hasMarkers ? 'markers_detected' : 'verbatim_unknown')
        : null
    console.log('[gen-fast] broll plan received', {
      degraded: body.brollDegraded ?? null,
      scenes_count: body.brollScenes?.length ?? body.brollQueries?.length ?? 0,
      has_markers_in_script: parsedScript.hasMarkers,
      will_use_verbatim: verbatim,
      reason_for_verbatim: verbatim
        ? (brollDegraded ? 'plan_degraded' : parsedScript.hasMarkers ? 'markers_detected' : 'unknown')
        : null,
    })

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
    // Push #486 — build the scene→plan alignment ONCE, before the clip loop.
    // alignedMeta[idx] replaces the old brollSceneMap.get(idx+1) lookup.
    const alignedMeta: (BrollSceneMeta | undefined)[] = new Array(scenes.length).fill(undefined)
    if (!verbatim && brollSceneMap.size > 0) {
      const planEntries = Array.from(brollSceneMap.entries()).sort((a, b) => a[0] - b[0])
      const planTokens = planEntries.map(([, m]) => alignTokens(m.narration ?? ''))
      const haveNarration = planTokens.some((t) => t.size > 0)
      const sameCount = planEntries.length === scenes.length
      const taken = new Set<number>()
      console.log(
        `[broll-align] plan=${planEntries.length} scenes=${scenes.length} narration=${haveNarration} mode=${sameCount ? 'direct-1:1' : haveNarration ? 'content' : 'proportional'}`,
      )
      for (let i = 0; i < scenes.length; i++) {
        let chosen = -1
        let bestScore = 0
        let method = 'index'
        // Happy path: when the plan and the route agree on scene count, keep the
        // direct 1:1 mapping — content matching only runs when counts DIFFER.
        if (!sameCount && haveNarration) {
          const sceneTok = alignTokens(
            `${scenes[i].voiceover ?? ''} ${scenes[i].description ?? ''}`,
          )
          // Require meaningful overlap; below the threshold positional mapping
          // is safer than a weak content match. Small penalty on plan scenes
          // already taken so distinct route scenes spread across the plan.
          let best = 0.3
          for (let j = 0; j < planEntries.length; j++) {
            const score = alignOverlap(sceneTok, planTokens[j]) - (taken.has(j) ? 0.15 : 0)
            if (score > best) {
              best = score
              chosen = j
            }
          }
          if (chosen !== -1) {
            method = 'content'
            bestScore = best
          }
        }
        if (chosen === -1) {
          // Positional fallback: identical to legacy behavior when counts match,
          // proportional (relative position, no off-by-one drift) when they differ.
          chosen = sameCount
            ? i
            : scenes.length > 1
              ? Math.round((i * (planEntries.length - 1)) / (scenes.length - 1))
              : 0
          method = sameCount ? 'index' : 'proportional'
        }
        if (chosen >= 0 && chosen < planEntries.length) {
          taken.add(chosen)
          alignedMeta[i] = planEntries[chosen][1]
          console.log(
            `[broll-align] scene ${i + 1} ↔ plan ${planEntries[chosen][0]} (score ${bestScore.toFixed(2)}, ${method})`,
          )
        }
      }
    }

    const usedPexelsUrls = new Set<string>()
    const clipUrls: string[] = []
    // KINEO-FAST-CINEMA-2026-07-10 — per-video style memory. Every picked clip
    // deposits its cinematic style tags (aerial/night/fog/...) here; later
    // scenes get a ranking bonus for matching them, so one video keeps ONE
    // consistent look (the AI Gen signature) instead of a stock patchwork.
    const styleCtx = { tags: new Set<string>() }
    // Push #355 — track B-roll source per scene for quality metrics.
    type ClipSource = 'pixabay' | 'fallbackA' | 'stockLibrary' | 'none'
    const clipSources: ClipSource[] = []

    for (let idx = 0; idx < scenes.length; idx++) {
      const scene = scenes[idx]
      const cat = scene.visualCategory ?? ''
      const sceneNo = idx + 1

      // Push #349 — pull this scene's BrollPlan metadata (1-based sceneNumber).
      // Hotfix (12/06): in VERBATIM mode the user hand-picked a [Pexels: ...]
      // query for every scene — the BrollPlan (built by splitting the marked
      // text its own way, so scene numbers don't even align) must NEVER
      // override them. Joseph's gift video #1: "private jet interior luxury"
      // was replaced by a plan query that returned coins-on-dollar-bills.
      // Push #486 — content-aligned plan meta (was: brollSceneMap.get(sceneNo),
      // an index lookup that shifted every query when plan/scene counts differ).
      const brollMeta = verbatim ? undefined : alignedMeta[idx]
      // v3.0 Phase 1: if a BrollPlan provided a specific AI-directed pexelsQuery
      // for this scene, use it as the primary search — it's far more specific
      // (e.g. "Wall Street trading floor 1987 crash") than GPT's generic scene
      // description.
      const brollOverride = verbatim ? undefined : brollMeta?.pexelsQuery
      const relevanceScore = brollMeta?.relevanceScore
      const purpose = (brollMeta?.scenePurpose ?? scene.scenePurpose ?? '').toString()
      const durationSeconds = brollMeta?.durationSeconds
      const scoreLabel = typeof relevanceScore === 'number' ? String(relevanceScore) : 'n/a'
      const durLabel = typeof durationSeconds === 'number' ? `${durationSeconds}` : '?'

      // Push #350 — requiresExtension: true means the AI Visual Director found no
      // safe Pexels query for this scene (blacklisted topic). Skip the Pexels search
      // entirely and go straight to FALLBACK-A (extend the previous relevant clip).
      if (brollMeta?.requiresExtension && clipUrls.length > 0) {
        const extUrl = findPreviousRelevantClip(clipUrls, usedPexelsUrls, idx)
        if (extUrl) {
          clipUrls.push(extUrl)
          clipSources.push('fallbackA') // #355
          console.log(
            `[clip] scene=${sceneNo} purpose=${purpose} duration=${durLabel}s source=FALLBACK-A(requiresExtension) score=${scoreLabel} url=${extUrl.slice(0, 60)}`,
          )
          continue
        }
        // No prior relevant clip — fall through to normal search (will likely
        console.log(`[clip] scene=${sceneNo} requiresExtension=true but no prior relevant clip — continuing to normal search`)
      }

      // Push #349 — Timeline balancing. A tiny trailing gap (<3s) isn't worth a
      // fresh Pexels search (and a brand-new clip flashing for under 3 seconds
      // looks jarring) — just extend whatever clip preceded it so the timeline
      // stays full and visually coherent. Only fires when we know the planned
      // duration (BrollPlan metadata present) and there is a prior clip.
      if (typeof durationSeconds === 'number' && durationSeconds < 3 && clipUrls.length > 0) {
        const prevUrl = clipUrls[clipUrls.length - 1]
        clipUrls.push(prevUrl)
        clipSources.push('fallbackA') // #355
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
      // Push #350 — if this scene has no people/lifestyle vocabulary, filter out
      // any stock clips that carry people/lifestyle tags so a random portrait
      // clip never lands as the fallback for mystery/history/finance content.
      const PEOPLE_STOCK_TAGS = new Set(['lifestyle', 'people', 'person', 'portrait', 'fashion', 'celebrity'])
      const hasPeopleVocab = sceneHasPeopleVocabulary(
        scene.voiceover ?? '',
        scene.description ?? '',
        scene.searchKeywords ?? '',
      )
      let libCandidates: LibraryClip[] = pickLibraryClips(verbatim ? scene.stockSearchQuery : libQuery, 4, idx)
      if (!hasPeopleVocab) {
        const safe = libCandidates.filter((c) => !c.tags.some((t) => PEOPLE_STOCK_TAGS.has(t)))
        if (safe.length > 0) libCandidates = safe
      }
      // Push #437 — never let a finance/money/billionaire scene fall back to an
      // ocean/animal/nature clip (the "school of fish for 'the asset'" bug). Only
      // keep nature clips when the scene actually talks about nature/animals.
      const ANIMAL_NATURE_STOCK_TAGS = new Set(['ocean', 'water', 'sea', 'underwater', 'animal', 'wildlife', 'nature', 'forest'])
      const natureText = `${scene.voiceover ?? ''} ${scene.description ?? ''} ${scene.searchKeywords ?? ''} ${libQuery}`.toLowerCase()
      const sceneIsNature = /\b(ocean|sea|water|wave|fish|animal|wildlife|nature|forest|mountain|river|jungle|reef|whale|shark|bird)\b/.test(natureText)
      if (!sceneIsNature) {
        const safe = libCandidates.filter((c) => !c.tags.some((t) => ANIMAL_NATURE_STOCK_TAGS.has(t)))
        if (safe.length > 0) libCandidates = safe
      }
      const fallbackUrl = libCandidates[0]?.url ?? ''

      // Push #353 — PIXABAY PRIMARY SOURCE.
      // New hierarchy: PIXABAY → FALLBACK-A (cycling #352) → FALLBACK-B (stockLibrary)
      // Toggle: ENABLE_PIXABAY=false falls straight through to FALLBACK-A/B.
      const queryUsed = brollOverride ?? scene.stockSearchQuery ?? libQuery
      const pixabayEnabled = process.env.ENABLE_PIXABAY !== 'false'

      if (pixabayEnabled) {
        // Build ordered query list for Pixabay: BrollPlan multi-query preferred,
        // then single brollOverride, then stockSearchQuery, then libQuery.
        let pixQueries: string[] =
          brollMeta?.pexelsQueries && brollMeta.pexelsQueries.length > 0
            ? brollMeta.pexelsQueries
            : brollOverride
              ? [brollOverride]
              : scene.stockSearchQuery
                ? [scene.stockSearchQuery]
                : libQuery
                  ? [libQuery]
                  : []

        // Fix 03/07 — HOOK ANTI-OFFTOPIC GUARD (scene 1 only). Scene 1 is the
        // visual hook; one off-topic clip there kills the video (the "snow clip
        // on a cave video" bug, 11h20 E2E). If a planned query shares ZERO
        // content tokens with this scene's own text, it's plan misalignment or
        // a hallucinated location — drop it and fall back to the scene's own
        // stockSearchQuery. Other scenes keep the #486 content alignment as-is.
        if (idx === 0 && pixQueries.length > 0) {
          const HOOK_STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'at', 'and', 'or', 'to', 'for', 'with', 'this', 'that', 'is', 'are', 'was', 'were', 'it', 'its', 'from', 'by', 'into', 'over', 'under', 'aerial', 'view', 'shot', 'footage', 'cinematic'])
          const tokensOf = (s: string) =>
            s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !HOOK_STOP.has(t))
          const sceneTokens = new Set(
            tokensOf(`${scene.voiceover ?? ''} ${scene.description ?? ''} ${scene.searchKeywords ?? ''} ${scene.stockSearchQuery ?? ''}`),
          )
          const onTopic = pixQueries.filter((q) => tokensOf(q).some((t) => sceneTokens.has(t)))
          if (onTopic.length < pixQueries.length) {
            console.log(
              `[hook-guard] scene=1 dropped ${pixQueries.length - onTopic.length}/${pixQueries.length} off-topic planned queries`,
            )
          }
          if (onTopic.length > 0) {
            pixQueries = onTopic
          } else if (scene.stockSearchQuery || libQuery) {
            // All planned queries off-topic — trust the scene's own text instead.
            pixQueries = [scene.stockSearchQuery || libQuery]
            console.log(`[hook-guard] scene=1 all planned queries off-topic — using scene's own query`)
          }
        }

        if (pixQueries.length > 0) {
          const sceneNeedsPeople = sceneHasPeopleVocabulary(
            scene.voiceover ?? '',
            scene.description ?? '',
            scene.searchKeywords ?? '',
          )
          // Fast Mode v2 (02/07) — ranked mini-pool per scene (strongest clip
          // first, so scene 1's lead clip = the strongest of its whole pool —
          // the visual hook). Near the total cap we drop back to 1 clip/scene.
          // KINEO-FAST-CINEMA (10/07) — the HOOK scene gets 3 clips instead of
          // 2: faster cuts in the first seconds is the AI Gen retention
          // signature, and scene 1 is where a Fast video wins or loses the
          // viewer. Same single pool call — just a deeper take from it.
          const perScene = idx === 0 ? FAST_CLIPS_PER_SCENE + 1 : FAST_CLIPS_PER_SCENE
          const clipsWanted = Math.max(
            1,
            Math.min(perScene, FAST_MAX_TOTAL_CLIPS - clipUrls.length),
          )
          const pixUrls = await getPixabayClipsForScene(
            pixQueries,
            sceneNeedsPeople,
            (scene.voiceover ?? '').slice(0, 80),
            // (12/06) exact: user-authored [Pexels: ...] queries are sovereign —
            // no concept-map prepending. exclude: never reuse a clip another
            // scene already took (the same-Dubai-aerial-4x bug).
            // Push #483 — minDurationSec: clips long enough to cover the planned
            // scene duration rank higher (kills freeze/loop padding on short clips).
            { exact: verbatim, exclude: usedPexelsUrls, minDurationSec: durationSeconds, maxClips: clipsWanted, styleCtx },
          )
          if (pixUrls.length > 0) {
            for (const pixUrl of pixUrls) {
              console.log(
                `[clip] scene=${sceneNo} purpose=${purpose} duration=${durLabel}s query="${(pixQueries[0] ?? '').slice(0, 60)}" source=PIXABAY score=${scoreLabel} url=${pixUrl.slice(0, 60)}`,
              )
              clipUrls.push(pixUrl)
              usedPexelsUrls.add(pixUrl) // (12/06) cross-scene dedup
              clipSources.push('pixabay') // #355 — one entry per clip; ratios stay valid
            }
            continue
          }
          console.log(`[clip] scene=${sceneNo} Pixabay miss — falling through to FALLBACK-A/B`)
        }
      }

      // FALLBACK-A: cycle through previous valid clips (#352 — intelligent cycling).
      const previousRelevantUrl = findPreviousRelevantClip(clipUrls, usedPexelsUrls, idx)

      // FALLBACK-B: stockLibrary (Cloudinary — pre-curated, pre-approved).
      const libUrl = previousRelevantUrl ?? fallbackUrl

      if (libUrl) {
        const fbSource = previousRelevantUrl ? 'FALLBACK-A' : 'FALLBACK-B'
        if (previousRelevantUrl) {
          console.log(`[clip] scene=${sceneNo} FALLBACK-A: cycling to prior clip (#352)`)
          clipSources.push('fallbackA') // #355
        } else {
          console.log(`[clip] scene=${sceneNo} FALLBACK-B: stockLibrary url=${fallbackUrl.slice(0, 60)}`)
          clipSources.push('stockLibrary') // #355
        }
        console.log(
          `[clip] scene=${sceneNo} purpose=${purpose} duration=${durLabel}s query="${(queryUsed ?? '').slice(0, 60)}" source=${fbSource} score=${scoreLabel} url=${libUrl.slice(0, 60)}`,
        )
        clipUrls.push(libUrl)
      } else {
        // Absolute last resort — no prior clip AND no stockLibrary match.
        console.log(
          `[clip] scene=${sceneNo} purpose=${purpose} duration=${durLabel}s source=NONE url=(none)`,
        )
        clipUrls.push('')
        clipSources.push('none') // #355
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

    // Push #355 — Compute B-roll quality metrics and write to broll_metrics.
    // Best-effort: failures never block the video response.
    try {
      const totalSources = clipSources.filter((s) => s !== 'none').length || 1
      const countOf = (src: ClipSource) => clipSources.filter((s) => s === src).length
      const brollSourceDistribution = {
        pixabay:      parseFloat((countOf('pixabay')      / totalSources).toFixed(3)),
        fallbackA:    parseFloat((countOf('fallbackA')    / totalSources).toFixed(3)),
        stockLibrary: parseFloat((countOf('stockLibrary') / totalSources).toFixed(3)),
      }

      const uniqueClipsCount = new Set(filtered).size

      // Average relevance score across scenes that have one (from BrollPlan).
      const relevanceScores = Array.from(brollSceneMap.values())
        .map((m) => m.relevanceScore)
        .filter((s): s is number => typeof s === 'number')
      const relevanceScoreAvg =
        relevanceScores.length > 0
          ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length
          : null

      const { error: metricsErr } = await supabase
        .from('broll_metrics')
        .insert({
          generation_id:            generationId,
          user_id:                  user.id,
          broll_source_distribution: brollSourceDistribution,
          unique_clips_count:       uniqueClipsCount,
          relevance_score_avg:      relevanceScoreAvg,
          degraded_reason:          degradedReason, // #358 instrumentation
        })

      if (metricsErr) {
        // PASSO 3 (20260530) — never fail silently. Capture the full PostgREST
        // error (code/message/details/hint) explicitly so broll_metrics insert
        // failures are traceable in logs. Still non-blocking by design: a metrics
        // write must never stop the user's video from being delivered.
        console.error('[broll_metrics] insert failed:', JSON.stringify({
          code: (metricsErr as { code?: string }).code,
          message: metricsErr.message,
          details: (metricsErr as { details?: string }).details,
          hint: (metricsErr as { hint?: string }).hint,
          generation_id: generationId,
          user_id_prefix: user.id.slice(0, 8),
        }))
      } else {
        console.log(
          `[broll_metrics] inserted generation_id=${generationId}`,
          JSON.stringify({ brollSourceDistribution, uniqueClipsCount, relevanceScoreAvg }),
        )
      }
    } catch (metricsEx) {
      // PASSO 3 (20260530) — escalate the thrown case to console.error too so
      // an unexpected exception in the metrics path is never swallowed silently.
      console.error('[broll_metrics] compute/insert threw:', metricsEx instanceof Error ? metricsEx.message : String(metricsEx))
    }

    // Push #132 — assemble the caption/voiceover pipeline. Each scene now
    // carries the SAME source string for both: the per-scene `voiceover` is
    // the narration TTS will read, and the per-scene `caption` is its
    // <=8-word readable on-screen paraphrase. We log both so any future
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
