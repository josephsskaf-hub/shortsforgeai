// app/api/youtube/auth/route.ts — Push #317
// Initiates the Google OAuth flow for YouTube access.
// Redirects the browser to Google's consent screen.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildYouTubeAuthUrl } from '@/lib/youtube'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  // state carries the user ID so the callback can look them up after redirect
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64url')
  const authUrl = buildYouTubeAuthUrl(state)
  return NextResponse.redirect(authUrl)
}
