import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Lazy init — prevents build-time throw when OPENAI_API_KEY is not in env
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })
}

// ─── Style prompt enhancers ────────────────────────────────────────────────
const STYLE_ENHANCERS: Record<string, string> = {
  'mrbeast':
    'MrBeast YouTube thumbnail style, extreme over-the-top reaction face expression, bold bright saturated colors, dramatic perspective, massive shock value, ultra high-energy composition, cinematic lighting with strong highlights, viral clickbait aesthetic, professional studio quality',
  'mystery':
    'dark mysterious YouTube thumbnail, eerie shadowy atmosphere, dramatic chiaroscuro lighting, glowing ethereal elements, deep moody color grade, suspenseful tension, conspiracy aesthetic, ultra clickable design, cinematic depth',
  'finance':
    'professional finance YouTube thumbnail, dramatic money visualization, Wall Street aesthetic, bold confident composition, clean modern layout, gold and navy color palette, wealth and success symbolism, premium professional quality',
  'documentary':
    'documentary style YouTube thumbnail, photojournalistic composition, dramatic environmental lighting, authentic emotional human moment, cinematic wide-angle framing, National Geographic quality, award-winning photo journalism',
  'viral-facts':
    'viral facts YouTube thumbnail, mind-blowing visual metaphor, bold dramatic numbers, shocking statistics visualization, extreme contrast, ultra-high saturation, brain-exploding composition, hyper-clickable design',
  'gaming':
    'gaming YouTube thumbnail, epic cinematic game screenshot aesthetic, dramatic neon lighting effects, intense action moment frozen in time, vibrant gaming color palette, esports production quality, maximum visual impact',
  'minimal':
    'minimal clean YouTube thumbnail, elegant negative space composition, simple but powerful central visual, premium modern design, carefully balanced layout, sophisticated typography space, Apple-quality aesthetic',
  'cinematic':
    'cinematic movie poster YouTube thumbnail, Hollywood blockbuster quality, dramatic atmospheric lighting, ultra-realistic high detail, emotional storytelling composition, anamorphic lens aesthetic, Oscar-worthy visual design',
}

// ─── Build optimized prompt ────────────────────────────────────────────────
function buildOptimizedPrompt(userPrompt: string, style: string): string {
  const enhancer = STYLE_ENHANCERS[style] ?? STYLE_ENHANCERS['cinematic']
  const cleanPrompt = userPrompt.trim().replace(/[^\w\s,.'"-!?]/g, ' ').trim()

  return (
    `YouTube thumbnail: ${cleanPrompt}. ` +
    `${enhancer}. ` +
    `16:9 landscape format, ultra-detailed, professional photography or digital art quality, ` +
    `no text overlays, no watermarks, ultra HD resolution, maximum visual impact`
  )
}

// ─── POST /api/generate-thumbnail ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { prompt, style, count = 1 } = await req.json()

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return NextResponse.json({ error: 'Prompt too short.' }, { status: 400 })
    }
    if (prompt.trim().length > 400) {
      return NextResponse.json({ error: 'Prompt too long (max 400 chars).' }, { status: 400 })
    }

    const validCount = Math.min(Math.max(Number(count) || 1, 1), 3)
    const optimizedPrompt = buildOptimizedPrompt(prompt, style || 'cinematic')

    const openai = getOpenAI()

    // Generate thumbnails in parallel
    const tasks = Array.from({ length: validCount }, () =>
      openai.images.generate({
        model: 'dall-e-3',
        prompt: optimizedPrompt,
        n: 1,
        size: '1792x1024',        // YouTube thumbnail aspect ratio (16:9)
        quality: 'standard',
        response_format: 'url',
      })
    )

    const results = await Promise.all(tasks)
    const urls = results.map((r) => r.data[0]?.url).filter(Boolean)

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

    // Surface OpenAI content policy refusals cleanly
    if (msg.toLowerCase().includes('content policy') || msg.toLowerCase().includes('safety')) {
      return NextResponse.json(
        { error: 'Your prompt was flagged. Try rephrasing it.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
