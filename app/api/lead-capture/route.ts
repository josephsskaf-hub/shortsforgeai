import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// #456 — Measure 1 (leads). Saves an email captured by the landing exit-intent
// lead magnet into the `leads` table. Uses the service-role client (RLS on, no
// public policy). Duplicate emails are treated as success — a returning lead is
// not an error, and we never block the user's reward on a save failure.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const raw = typeof body?.email === 'string' ? body.email : ''
    const email = raw.trim().toLowerCase()
    if (!email || !email.includes('@') || email.length > 200) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.error('[lead-capture] Supabase service env missing')
      // Don't fail the UX — the magnet still shows client-side.
      return NextResponse.json({ ok: true, saved: false })
    }

    const admin = createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const country = req.headers.get('x-vercel-ip-country') ?? null
    const source = typeof body?.source === 'string' ? body.source.slice(0, 60) : 'unknown'
    const magnet = typeof body?.magnet === 'string' ? body.magnet.slice(0, 60) : null

    const { error } = await admin
      .from('leads')
      .insert({ email, source, magnet, signup_country: country })

    // A unique-violation (already a lead) is fine — treat as success.
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.error('[lead-capture] insert error:', error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[lead-capture] error:', msg)
    return NextResponse.json({ ok: true, saved: false })
  }
}
