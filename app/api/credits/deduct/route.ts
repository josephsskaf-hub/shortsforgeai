// Run this in Supabase SQL editor if `video_credits` doesn't exist:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_credits integer DEFAULT 3;

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 })
    }

    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('video_credits')
      .eq('id', user.id)
      .single()

    if (fetchError) {
      console.error('[credits/deduct] fetch error:', fetchError.message)
      return NextResponse.json(
        { error: 'Could not load credit balance', success: false },
        { status: 500 }
      )
    }

    const current = profile?.video_credits ?? 0
    if (current <= 0) {
      return NextResponse.json(
        { error: 'No credits remaining', credits: 0, success: false },
        { status: 402 }
      )
    }

    const next = current - 1
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ video_credits: next })
      .eq('id', user.id)
      .gt('video_credits', 0)

    if (updateError) {
      console.error('[credits/deduct] update error:', updateError.message)
      return NextResponse.json(
        { error: 'Failed to deduct credit', success: false },
        { status: 500 }
      )
    }

    return NextResponse.json({ credits: next, success: true })
  } catch (err) {
    console.error('[credits/deduct] unexpected:', err)
    return NextResponse.json(
      { error: 'Unexpected error', success: false },
      { status: 500 }
    )
  }
}
