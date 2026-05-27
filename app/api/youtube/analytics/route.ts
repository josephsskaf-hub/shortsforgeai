// app/api/youtube/analytics/route.ts — Push #317
// Returns channel stats + recent video analytics for the connected YouTube account.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  loadYouTubeTokens,
  getValidAccessToken,
  saveYouTubeTokens,
  fetchChannelStats,
  fetchRecentVideoAnalytics,
} from '@/lib/youtube'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const tokens = await loadYouTubeTokens(user.id)
    if (!tokens) {
      return NextResponse.json({ error: 'YouTube not connected.' }, { status: 403 })
    }

    const { accessToken, updatedTokens } = await getValidAccessToken(tokens)
    if (updatedTokens) {
      await saveYouTubeTokens(user.id, updatedTokens)
    }

    const [channelStats, recentVideos] = await Promise.all([
      fetchChannelStats(accessToken),
      fetchRecentVideoAnalytics(accessToken, 10),
    ])

    return NextResponse.json({ channelStats, recentVideos })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[youtube/analytics] error:', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
