// KINEO-UGC-AD-2026-07-10 — UGC Ad Mode (Feature 4, Upwork-validated:
// "AI UGC ads" jobs pay $100-200 per PACK, recurring, e-commerce/dropshipping).
// Takes a product (name/description/URL text) + target audience and returns a
// 15-30s UGC-style ad script (aggressive hook → benefits → CTA) written to be
// spoken VERBATIM by the AI Presenter / Avatar Studio — the creator-talking-
// to-camera format that converts on TikTok/Reels/Shorts.
//
// This intentionally reuses the existing pipeline: the script drops into the
// Avatar Studio script box (scriptMode 'verbatim') or the Short flow. No new
// render path — the template IS the feature.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

type Language = 'en' | 'pt' | 'es'

function buildAdSystemPrompt(language: Language): string {
  const langInstruction =
    language === 'pt'
      ? 'LANGUAGE: Write the spoken script in Brazilian Portuguese (pt-BR).'
      : language === 'es'
      ? 'LANGUAGE: Write the spoken script in Spanish (es-419).'
      : 'LANGUAGE: Write in US English.'

  return `You are a top-performing UGC (user-generated content) ad scriptwriter for TikTok/Reels/Shorts. You write scripts that a single creator speaks DIRECTLY to camera, selfie-style. Your scripts consistently pass the 3-second scroll test.

${langInstruction}

STRUCTURE (15-30 seconds spoken, 55-85 words TOTAL — this is an AD, keep it tight):
1. HOOK (first line, ≤12 words): a pattern interrupt about the PROBLEM or a bold claim. Never start with "Hey guys" or the product name.
2. PROBLEM AGITATION (1 short line): make the target audience feel seen.
3. PRODUCT REVEAL (1 line): introduce the product as the discovery ("I found / this is").
4. BENEFITS (2-3 punchy lines): concrete outcomes, not features. Numbers when plausible from the product info given. NEVER invent specific fake statistics, medical claims, or personal income results.
5. CTA (last line): urgency + where to get it.

VOICE RULES:
- First person, conversational, like texting a friend — contractions, short sentences.
- Write ONLY the spoken words. No camera directions, no emojis, no hashtags, no section headers, no quotes.
- Each sentence on its own line.
- COMPLIANCE: no fabricated personal results ("I made $10k"), no health/medical cure claims, no "guaranteed". Benefit language must stay plausible and tied to what the product info actually says (FTC-safe).`
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 })
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { product?: string; audience?: string; offer?: string; language?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    const product = (body.product ?? '').trim().slice(0, 1200)
    if (!product) {
      return NextResponse.json({ error: 'Describe the product (or paste the product page text).' }, { status: 400 })
    }
    const audience = (body.audience ?? '').trim().slice(0, 300)
    const offer = (body.offer ?? '').trim().slice(0, 200)
    const language: Language = body.language === 'pt' ? 'pt' : body.language === 'es' ? 'es' : 'en'

    const userPrompt = [
      `PRODUCT INFO:\n${product}`,
      audience ? `TARGET AUDIENCE: ${audience}` : null,
      offer ? `OFFER/CTA DETAILS: ${offer}` : null,
      'Write ONE ad script now.',
    ].filter(Boolean).join('\n\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.8,
      max_tokens: 400,
      messages: [
        { role: 'system', content: buildAdSystemPrompt(language) },
        { role: 'user', content: userPrompt },
      ],
    })
    const script = (completion.choices[0]?.message?.content ?? '').trim()
    if (!script) {
      return NextResponse.json({ error: 'Could not write the ad script. Please try again.' }, { status: 502 })
    }

    console.log(`[ad-script] generated user=${user.id.slice(0, 8)} words=${script.split(/\s+/).length}`)
    return NextResponse.json({ script, language })
  } catch (err) {
    console.error('[ad-script] unexpected error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
