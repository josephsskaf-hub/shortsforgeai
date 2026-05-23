// Run this in Supabase SQL editor if `video_credits` doesn't exist:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_credits integer DEFAULT 1;

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Free-tier default: 1 video credit on signup (push #020 pricing policy).
const DEFAULT_CREDITS = 1

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
      .select('video_credits')
      .eq('id', user.id)
      .single()

    if (error) {
      // Column may not exist yet — return default safely
      if (error.code === '42703' || error.message?.includes('video_credits')) {
        return NextResponse.json({ credits: DEFAULT_CREDITS, migrationNeeded: true })
      }
      // No row found (new user before profiles row exists) — give them the free tier.
      if (error.code === 'PGRST116') {
        return NextResponse.json({ credits: DEFAULT_CREDITS })
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
    return NextResponse.json({ credits })
  } catch (err) {
    console.error('[credits GET] unexpected:', err)
    return NextResponse.json({ credits: 0, error: 'Failed to load credits' }, { status: 500 })
  }
}
