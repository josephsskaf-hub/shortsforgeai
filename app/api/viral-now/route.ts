// Push #337 — Viral Now: rebuilt GET handler using lib/viralTopics
// 6 deterministic topics based on 4-hour UTC seed — no Supabase dependency for reads
import { NextResponse } from 'next/server'
import { getViralNowTopics } from '@/lib/viralTopics'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const topics = getViralNowTopics()
    return NextResponse.json({ topics })
  } catch (err) {
    console.error('[viral-now] error:', err)
    return NextResponse.json({ topics: [] }, { status: 500 })
  }
}
