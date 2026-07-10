// KINEO-CHARACTER-LOCK-2026-07-10 — Character Lock API (Feature 2).
// GET    → the user's saved characters (My Characters library)
// POST   → save a character { name, imageUrl, source? } (image is persisted
//          into our avatars bucket server-side; fal URLs are mirrored)
// DELETE → ?id= remove a character (owner-scoped)
//
// Premium surface: free accounts save 1 character, paying accounts 12
// (characterLimitFor). The generation routes resolve character ids via
// getCharacterImageUrl — the client never injects raw URLs into renders.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  characterLimitFor,
  countCharacters,
  deleteCharacter,
  extractCharacterTraits,
  listCharacters,
  persistCharacterImage,
  saveCharacter,
} from '@/lib/characters'

export const dynamic = 'force-dynamic'

async function requireUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  try {
    const { user } = await requireUser()
    if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    const characters = await listCharacters(user.id)
    return NextResponse.json({ characters })
  } catch (err) {
    console.error('[characters] GET failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Could not load your characters.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireUser()
    if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })

    let body: { name?: string; imageUrl?: string; source?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }
    const name = (body.name ?? '').trim()
    const imageUrl = (body.imageUrl ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Give your character a name.' }, { status: 400 })
    if (!imageUrl) return NextResponse.json({ error: 'Character image is required.' }, { status: 400 })

    // KINEO-CHARLOCK-V2-2026-07-10 — per-plan limits from the paid-job
    // briefing: FREE = 0 (the locked UI is the upgrade bait), Starter/Creator
    // = 3, Studio = 10. Counted server-side (never localStorage).
    const { data: profile } = await supabase
      .from('profiles')
      .select('has_paid, plan')
      .eq('id', user.id)
      .single()
    const plan = (profile?.plan ?? '').toString()
    const hasPaid = profile?.has_paid === true
    const limit = characterLimitFor(plan, hasPaid)
    const current = await countCharacters(user.id)
    if (limit === 0) {
      return NextResponse.json(
        {
          error: 'Saving characters is a paid feature — lock the SAME face into every video and thumbnail you make. Upgrade to unlock it.',
          upsell: 'credits',
          upgrade: '/pricing',
        },
        { status: 402 },
      )
    }
    if (current >= limit) {
      return NextResponse.json(
        {
          error: `You reached your ${limit}-character limit${limit < 10 ? ' — upgrade to Studio for 10 characters, or' : ' —'} delete one to save a new one.`,
          upgrade: '/pricing',
        },
        { status: 409 },
      )
    }

    const source = ['upload', 'scene', 'hollywood', 'other'].includes((body.source ?? '').toString())
      ? (body.source as string)
      : 'upload'
    // KINEO-CHARLOCK-V2 — persist first, then best-effort trait extraction on
    // the PERSISTED public URL (vision needs a reachable URL; failure never
    // blocks the save).
    const persistedUrl = await persistCharacterImage(user.id, imageUrl)
    const traits = await extractCharacterTraits(persistedUrl)
    const character = await saveCharacter({ userId: user.id, name, imageUrl: persistedUrl, source, traits })
    console.log(`[characters] saved user=${user.id.slice(0, 8)} id=${character.id} source=${source} traits=${traits ? 'yes' : 'no'}`)
    return NextResponse.json({ character })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[characters] POST failed:', msg)
    const friendly = msg.startsWith('Character image') || msg.startsWith('Could not download')
      ? msg
      : 'Could not save the character. Please try again.'
    return NextResponse.json({ error: friendly }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireUser()
    if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    const id = (req.nextUrl.searchParams.get('id') ?? '').trim()
    if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 })
    const ok = await deleteCharacter(user.id, id)
    return NextResponse.json({ ok })
  } catch (err) {
    console.error('[characters] DELETE failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Could not delete the character.' }, { status: 500 })
  }
}
