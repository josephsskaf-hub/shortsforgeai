// app/api/youtube/callback/route.ts — Push #317
// Handles the Google OAuth redirect, exchanges the code for tokens,
// persists them to Supabase, then redirects back to the dashboard.

import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, saveYouTubeTokens } from '@/lib/youtube'

export async function GET(req: NextRequest) {
  const appUrl = req.nextUrl.origin
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    console.error('[youtube/callback] OAuth error from Google:', error)
    return NextResponse.redirect(`${appUrl}/dashboard?youtube=error&reason=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard?youtube=error&reason=missing_params`)
  }

  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = decoded.userId
    if (!userId) throw new Error('no userId in state')
  } catch (e) {
    console.error('[youtube/callback] invalid state param:', e)
    return NextResponse.redirect(`${appUrl}/dashboard?youtube=error&reason=invalid_state`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await saveYouTubeTokens(userId, tokens)
    console.log(`[youtube/callback] tokens saved for user ${userId.slice(0, 8)}`)
    return NextResponse.redirect(`${appUrl}/dashboard?youtube=connected`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[youtube/callback] token exchange/save failed:', msg)
    return NextResponse.redirect(`${appUrl}/dashboard?youtube=error&reason=${encodeURIComponent(msg)}`)
  }
}
