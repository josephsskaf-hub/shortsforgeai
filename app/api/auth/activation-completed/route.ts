import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeInternalRedirect } from '@/lib/authRedirect'
import { writeServerEvent } from '@/lib/serverEvents'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const destination = normalizeInternalRedirect(
      typeof body?.destination === 'string' ? body.destination : null,
    ) ?? '/generate'
    const destinationUrl = new URL(destination, 'https://www.usekineo.com')
    const createdAt = Date.parse(user.created_at ?? '')
    const isRecentSignup = Number.isFinite(createdAt)
      && Date.now() - createdAt >= 0
      && Date.now() - createdAt < 5 * 60 * 1000

    const stored = await writeServerEvent({
      name: 'email_signup_completed',
      userId: user.id,
      path: '/signup',
      metadata: {
        destination_path: destinationUrl.pathname.slice(0, 128),
        has_prompt: destinationUrl.searchParams.has('prompt'),
        is_recent_signup: isRecentSignup,
      },
    })
    return NextResponse.json({ ok: true, stored })
  } catch (error) {
    console.error('[activation-completed] unexpected failure:', error)
    return NextResponse.json({ ok: true, stored: false })
  }
}
