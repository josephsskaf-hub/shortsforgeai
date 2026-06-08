import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Referral config (easy to change) ─────────────────────────────────────
// Credits each side earns — kept in sync with app/api/referral/qualify.
const REFERRAL_REWARD_CREDITS = 30
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shortsforgeai.com'
// 8-char uppercase alphanumeric code. Ambiguous chars (0/O/1/I) are removed
// so codes are easy to read aloud and type.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
// ─────────────────────────────────────────────────────────────────────────

function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('referral_code, referral_count')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('[referral GET] profile load error:', error.code, error.message)
      return NextResponse.json({ error: 'Could not load referral info.' }, { status: 500 })
    }

    let code = (profile?.referral_code ?? '').trim()

    // First visit — mint a unique code and persist it (own-row update, allowed
    // by RLS). Retry on the astronomically-rare unique collision (23505).
    if (!code) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateCode()
        const { error: updErr } = await supabase
          .from('profiles')
          .update({ referral_code: candidate })
          .eq('id', user.id)
        if (!updErr) {
          code = candidate
          break
        }
        if (updErr.code !== '23505') {
          // 42703 = column missing (migration not applied yet) — surface
          // nothing fatal; just return an empty code so the UI hides the card.
          console.error('[referral GET] code persist error:', updErr.code, updErr.message)
          break
        }
        // 23505 = collision — loop and try a fresh candidate.
      }
    }

    const count = profile?.referral_count ?? 0
    return NextResponse.json({
      code,
      count,
      url: `${APP_URL}/?ref=${code}`,
      rewardCredits: REFERRAL_REWARD_CREDITS,
    })
  } catch (err) {
    console.error('[referral GET] unexpected:', err)
    return NextResponse.json({ error: 'Failed to load referral info.' }, { status: 500 })
  }
}
