// Run this in Supabase SQL editor if `video_credits` doesn't exist:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_credits integer DEFAULT 2;

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Push #299 — 2 free credits on signup (up from 1). Improves activation rate.
const DEFAULT_CREDITS = 2

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('video_credits, free_ai_generate_used')
      .eq('id', user.id)
      .single()

    if (error) {
      // Column may not exist yet — return default safely
      if (error.code === '42703' || error.message?.includes('video_credits')) {
        return NextResponse.json({ credits: DEFAULT_CREDITS, migrationNeeded: true })
      }
      // No row found (new user before profiles row exists) — 0 credits until paid.
      if (error.code === 'PGRST116') {
        return NextResponse.json({ credits: 0 })
      }
      // Don't fall back to DEFAULT_CREDITS on an unknown error — that would hide a
      // real DB failure and let users start a generation they can't actually pay for.
      console.error('[credits GET] db error:', error.code, error.message)
      return NextResponse.json(
        { error: 'Could not load your credit balance. Please retry.' },
        { status: 500 }
      )
    }

    const credits = data?.video_credits ?? DEFAULT_CREDITS
    // #384 — also surface whether the 1 free AI-Generate trial is still available,
    // so the generator can label the AI card "1 free · watermark".
    return NextResponse.json({ credits, freeAiUsed: data?.free_ai_generate_used === true })
  } catch (err) {
    console.error('[credits GET] unexpected:', err)
    return NextResponse.json({ credits: 0, error: 'Failed to load credits' }, { status: 500 })
  }
}
