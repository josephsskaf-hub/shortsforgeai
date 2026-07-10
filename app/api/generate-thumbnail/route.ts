import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getCharacter } from '@/lib/characters'

// KINEO-CHARLOCK-V2-2026-07-10 — images.edit takes 35-40s per image; give the
// route room for a 3-variation locked set.
export const maxDuration = 150
export const dynamic = 'force-dynamic'

// Lazy init - prevents build-time throw when OPENAI_API_KEY is not in env
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })
}

// Style prompt enhancers
const STYLE_ENHANCERS: Record<string, string> = {
  mrbeast:
    'MrBeast YouTube thumbnail style, extreme over-the-top reaction face expression, bold bright saturated colors, dramatic perspective, massive shock value, ultra high-energy composition, cinematic lighting with strong highlights, viral clickbait aesthetic, professional studio quality',
  mystery:
    'dark mysterious YouTube thumbnail, eerie shadowy atmosphere, dramatic chiaroscuro lighting, glowing ethereal elements, deep moody color grade, suspenseful tension, conspiracy aesthetic, ultra clickable design, cinematic depth',
  finance:
    'professional finance YouTube thumbnail, dramatic money visualization, Wall Street aesthetic, bold confident composition, clean modern layout, gold and navy color palette, wealth and success symbolism, premium professional quality',
  documentary:
    'documentary style YouTube thumbnail, photojournalistic composition, dramatic environmental lighting, authentic emotional human moment, cinematic wide-angle framing, National Geographic quality, award-winning photo journalism',
  'viral-facts':
    'viral facts YouTube thumbnail, mind-blowing visual metaphor, bold dramatic numbers, shocking statistics visualization, extreme contrast, ultra-high saturation, brain-exploding composition, hyper-clickable design',
  gaming:
    'gaming YouTube thumbnail, epic cinematic game screenshot aesthetic, dramatic neon lighting effects, intense action moment frozen in time, vibrant gaming color palette, esports production quality, maximum visual impact',
  minimal:
    'minimal clean YouTube thumbnail, elegant negative space composition, simple but powerful central visual, premium modern design, carefully balanced layout, sophisticated typography space, Apple-quality aesthetic',
  cinematic:
    'cinematic movie poster YouTube thumbnail, Hollywood blockbuster quality, dramatic atmospheric lighting, ultra-realistic high detail, emotional storytelling composition, anamorphic lens aesthetic, Oscar-worthy visual design',
}

// Build optimized prompt
function buildOptimizedPrompt(userPrompt: string, style: string): string {
  const enhancer = STYLE_ENHANCERS[style] ?? STYLE_ENHANCERS['cinematic']
  const cleanPrompt = userPrompt.trim().replace(/[^\w\s,.'"!?-]/g, ' ').trim()

  return (
    'YouTube thumbnail: ' +
    cleanPrompt +
    '. ' +
    enhancer +
    '. ' +
    '16:9 landscape format, ultra-detailed, professional photography or digital art quality, ' +
    'no text overlays, no watermarks, ultra HD resolution, maximum visual impact'
  )
}

// KINEO-CHARLOCK-V2-2026-07-10 — THE character-lock prompt template (validated
// in production on the Rick job, worked first try). The rules that keep the
// SAME face across every generation:
//   1. ALWAYS open with "Recreate this exact same person" — that's the lock.
//   2. Repeat the fixed traits explicitly ("same glasses, same beard") — less drift.
//   3. Describe ONLY the requested change after "but".
//   4. Multi-angle sets: every image from the SAME anchor (never chained —
//      anchor→3/4→profile accumulates drift). Parallel calls below guarantee it.
function buildCharacterPrompt(userChange: string, traits: string | null, style: string): string {
  const cleanChange = userChange.trim().replace(/[^\w\s,.'"!?-]/g, ' ').trim()
  const traitPart = traits && traits.trim().length > 0
    ? ` — same ${traits.trim().replace(/,\s*/g, ', same ')} —`
    : ' — same identity —'
  const styleHint = STYLE_ENHANCERS[style] ? ` ${STYLE_ENHANCERS[style]}.` : ''
  return (
    `Recreate this exact same person — same face,${traitPart} ` +
    `but ${cleanChange}. ` +
    `Photorealistic, natural skin texture, professional lighting, no text overlays, no watermarks.` +
    styleHint
  )
}

// POST /api/generate-thumbnail
export async function POST(req: NextRequest) {
  try {
    const { prompt, style, count = 1, characterId, orientation } = await req.json()

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return NextResponse.json({ error: 'Prompt too short.' }, { status: 400 })
    }
    if (prompt.trim().length > 400) {
      return NextResponse.json({ error: 'Prompt too long (max 400 chars).' }, { status: 400 })
    }

    const validCount = Math.min(Math.max(Number(count) || 1, 1), 3)
    const openai = getOpenAI()

    // ── KINEO-CHARLOCK-V2 — character-locked path (images.EDIT, never
    // images.generate: text generation invents a new face every call; edit
    // COPIES the real face from the anchor photo). ────────────────────────
    if (typeof characterId === 'string' && characterId.trim().length > 0) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Sign in to use your characters.' }, { status: 401 })
      }
      const character = await getCharacter(user.id, characterId.trim())
      if (!character) {
        return NextResponse.json({ error: 'Character not found.' }, { status: 404 })
      }

      // Anchor download (our public storage URL, persisted at save time).
      const anchorRes = await fetch(character.image_url)
      if (!anchorRes.ok) {
        return NextResponse.json({ error: 'Could not load the character photo.' }, { status: 502 })
      }
      const anchorBuffer = Buffer.from(await anchorRes.arrayBuffer())

      // quality low ≈ $0.02/img & 35-40s; medium (4x cost) reserved for Studio.
      const { data: profile } = await supabase
        .from('profiles').select('plan').eq('id', user.id).single()
      const quality: 'low' | 'medium' = (profile?.plan ?? '') === 'pro' ? 'medium' : 'low'
      const size = orientation === 'vertical' ? '1024x1536' : '1536x1024'
      const characterPrompt = buildCharacterPrompt(prompt, character.traits, style || '')

      // Rule 4: every variation from the SAME anchor, in parallel.
      const editTasks = Array.from({ length: validCount }, async () =>
        openai.images.edit({
          model: 'gpt-image-2',
          image: await toFile(anchorBuffer, 'anchor.png', { type: 'image/png' }),
          prompt: characterPrompt,
          size: size as '1536x1024' | '1024x1536',
          quality,
        }),
      )
      const editResults = await Promise.all(editTasks)
      const editUrls = editResults
        .map((r) => {
          const item = r.data?.[0]
          if (item?.url) return item.url
          if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`
          return null
        })
        .filter(Boolean) as string[]
      if (editUrls.length === 0) {
        return NextResponse.json({ error: 'No images returned from API.' }, { status: 500 })
      }
      console.log(`[generate-thumbnail] character-locked user=${user.id.slice(0, 8)} char=${characterId.slice(0, 8)} n=${editUrls.length} q=${quality}`)
      return NextResponse.json({
        images: editUrls,
        optimizedPrompt: characterPrompt,
        style,
        count: editUrls.length,
        lockedTo: character.name,
      })
    }

    const optimizedPrompt = buildOptimizedPrompt(prompt, style || 'cinematic')

    // Generate thumbnails in parallel
    const tasks = Array.from({ length: validCount }, () =>
      openai.images.generate({
        model: 'gpt-image-2',
        prompt: optimizedPrompt,
        n: 1,
        size: '1536x1024',
        quality: 'high',
      })
    )

    const results = await Promise.all(tasks)
    const urls = results
      .map((r) => {
        const item = r.data?.[0]
        if (item?.url) return item.url
        if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`
        return null
      })
      .filter(Boolean) as string[]

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No images returned from API.' }, { status: 500 })
    }

    return NextResponse.json({
      images: urls,
      optimizedPrompt,
      style,
      count: validCount,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[generate-thumbnail] error:', msg)

    if (msg.toLowerCase().includes('content policy') || msg.toLowerCase().includes('safety')) {
      return NextResponse.json(
        { error: 'Your prompt was flagged. Try rephrasing it.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
