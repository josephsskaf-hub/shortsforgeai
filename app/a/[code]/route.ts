// #479 — Affiliate link handler: /a/{CODE}
// Logs the click, sets a 90-day FIRST-TOUCH cookie (only if not already set),
// then redirects to the homepage. Attribution is finalized at signup by
// /api/affiliate/attribute reading this cookie. Service-role only (RLS deny-all).
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const COOKIE = 'sf_aff'
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 // 90 days, in seconds
const SALT = process.env.AFFILIATE_IP_SALT ?? 'sf_aff_salt_v1'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.shortsforgeai.com'
  const code = (params.code ?? '').trim().toUpperCase().slice(0, 32)
  if (!code) return NextResponse.redirect(appUrl)

  try {
    const sb = admin()
    const { data: aff } = await sb
      .from('affiliates')
      .select('id, status')
      .eq('code', code)
      .single()

    // Unknown or inactive code → just send them home, no cookie, no click row.
    if (!aff || aff.status !== 'active') {
      return NextResponse.redirect(appUrl)
    }

    const res = NextResponse.redirect(appUrl)

    // Click log (fire-and-forget; never blocks the redirect).
    const ipRaw =
      (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      ''
    const ipHash = ipRaw ? createHash('sha256').update(ipRaw + SALT).digest('hex') : null
    await sb.from('affiliate_clicks').insert({
      affiliate_id: aff.id,
      ip_hash: ipHash,
      user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300),
      landing_path: `/a/${code}`,
      referrer: (req.headers.get('referer') ?? '').slice(0, 300),
    })

    // FIRST-TOUCH: only set the cookie if the visitor doesn't already have one.
    const existing = req.cookies.get(COOKIE)?.value
    if (!existing) {
      res.cookies.set(COOKIE, code, {
        maxAge: COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
      })
    }
    return res
  } catch (err) {
    console.error('[affiliate /a] error:', err)
    return NextResponse.redirect(appUrl)
  }
}
