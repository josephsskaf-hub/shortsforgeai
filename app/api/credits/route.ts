// Run this in Supabase SQL editor if `video_credits` doesn't exist:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_credits integer DEFAULT 3;

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_CREDITS = 3

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
      if (error.code === 'PGRST116') {
        return NextResponse.json({ credits: DEFAULT_CREDITS })
      }
      console.error('[credits GET] error:', error.message)
      return NextResponse.json({ credits: DEFAULT_CREDITS })
    }

    const credits = data?.video_credits ?? DEFAULT_CREDITS
    return NextResponse.json({ credits })
  } catch (err) {
    console.error('[credits GET] unexpected:', err)
    return NextResponse.json({ credits: 0, error: 'Failed to load credits' }, { status: 500 })
  }
}
