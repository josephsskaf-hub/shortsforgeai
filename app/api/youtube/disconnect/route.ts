// app/api/youtube/disconnect/route.ts — Push #317
// Removes the stored YouTube tokens for the current user.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { disconnectYouTube } from '@/lib/youtube'

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }
    await disconnectYouTube(user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[youtube/disconnect]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
