// app/api/youtube/status/route.ts — Push #317
// Returns whether the current user has a connected YouTube account.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadYouTubeTokens } from '@/lib/youtube'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ connected: false }, { status: 401 })
    }

    const tokens = await loadYouTubeTokens(user.id)
    return NextResponse.json({ connected: !!tokens })
  } catch (err) {
    console.error('[youtube/status]', err)
    return NextResponse.json({ connected: false })
  }
}
