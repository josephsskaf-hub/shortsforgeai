// Compatibility health check for the former Viral Now persistence cron.
//
// Viral Now has used the deterministic catalogue in lib/viralTopics since
// PUSH #337. The public API and UI no longer read viral_now_topics, so writing
// a second topic pool to Supabase was both redundant and a source of failures.
import { NextRequest, NextResponse } from 'next/server'
import { getViralNowTopics } from '@/lib/viralTopics'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const topics = getViralNowTopics()

    return NextResponse.json({
      ok: true,
      source: 'deterministic_catalogue',
      count: topics.length,
      persistence: 'disabled',
    })
  } catch (err) {
    console.error('[refresh-viral-now] health check failed:', err)
    return NextResponse.json({ error: 'Viral Now health check failed' }, { status: 500 })
  }
}
