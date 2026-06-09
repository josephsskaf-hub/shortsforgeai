// Affiliate self-serve — apply to become an affiliate.
// POST, auth required. Idempotent: if the signed-in user already owns an
// affiliate row we return it as-is. Otherwise we create one with a unique
// 8-char code, status 'pending' and a 40% commission rate. RLS on the
// affiliate_* tables is deny-all, so all writes use the service-role client.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Crockford-ish alphabet — no easily-confused chars (I, O, 0, 1).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(len = 8): string {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let body: { name?: string } = {}
    try {
      body = (await req.json()) as { name?: string }
    } catch {
      body = {}
    }
    const name =
      typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }

    const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Idempotent — already an affiliate? Return the existing row.
    const { data: existing } = await admin
      .from('affiliates')
      .select('status, code')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, status: existing.status, code: existing.code })
    }

    // Insert with a unique code, retrying on a unique-violation (23505) collision.
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateCode(8)
      const { data: created, error } = await admin
        .from('affiliates')
        .insert({
          user_id: user.id,
          email: user.email ?? null,
          name,
          code,
          status: 'pending',
          commission_rate: 0.4,
        })
        .select('status, code')
        .single()

      if (!error && created) {
        return NextResponse.json({ ok: true, status: created.status, code: created.code })
      }

      // 23505 = unique_violation. If it's the code, retry; otherwise it may be a
      // race where the user_id row was created concurrently — re-read and return.
      if (error && (error as { code?: string }).code === '23505') {
        const { data: raced } = await admin
          .from('affiliates')
          .select('status, code')
          .eq('user_id', user.id)
          .maybeSingle()
        if (raced) {
          return NextResponse.json({ ok: true, status: raced.status, code: raced.code })
        }
        // else: code collision — loop and try a new code
        continue
      }

      // Any other error — bail out.
      if (error) {
        console.error('[affiliate/apply] insert error:', error.message)
        return NextResponse.json({ error: 'Failed to apply' }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Could not generate a unique code' }, { status: 500 })
  } catch (err) {
    console.error('[affiliate/apply] unexpected:', err)
    return NextResponse.json({ error: 'Failed to apply' }, { status: 500 })
  }
}
