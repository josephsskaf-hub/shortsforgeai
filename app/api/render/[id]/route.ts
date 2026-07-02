import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refundRenderCredits } from '@/lib/credits/refund'

export const maxDuration = 30

type Status = 'rendering' | 'succeeded' | 'failed'

interface CreatomateRender {
  id?: string
  status?: string
  url?: string
  snapshot_url?: string
  error_message?: string
  progress?: number
}

function mapStatus(s: string | undefined): Status {
  switch ((s ?? '').toLowerCase()) {
    case 'succeeded':
      return 'succeeded'
    case 'failed':
    case 'cancelled':
      return 'failed'
    case 'planned':
    case 'waiting':
    case 'transcribing':
    case 'rendering':
    default:
      return 'rendering'
  }
}

function progressFromStatus(s: string | undefined, raw?: number): number {
  if (typeof raw === 'number' && raw >= 0 && raw <= 100) return Math.round(raw)
  switch ((s ?? '').toLowerCase()) {
    case 'planned':
      return 5
    case 'waiting':
      return 10
    case 'transcribing':
      return 25
    case 'rendering':
      return 60
    case 'succeeded':
      return 100
    case 'failed':
    case 'cancelled':
      return 0
    default:
      return 15
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    const id = (params.id ?? '').trim()
    if (!id) {
      return NextResponse.json({ error: 'Render id is required.' }, { status: 400 })
    }

    if (id.startsWith('mock-')) {
      return NextResponse.json({
        status: 'succeeded' as Status,
        url: null,
        isMock: true,
        progress: 100,
      })
    }

    const creatomateKey = process.env.CREATOMATE_API_KEY
    if (!creatomateKey) {
      return NextResponse.json(
        { error: 'Render service is not configured.' },
        { status: 500 }
      )
    }

    let res: Response
    try {
      res = await fetch(`https://api.creatomate.com/v1/renders/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${creatomateKey}` },
        cache: 'no-store',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[render/id] fetch error:', msg)
      return NextResponse.json(
        { error: 'Render service unreachable.' },
        { status: 502 }
      )
    }

    if (!res.ok) {
      console.error('[render/id] non-ok status:', res.status)
      return NextResponse.json(
        { error: 'Render service rejected the lookup.' },
        { status: 502 }
      )
    }

    const data = (await res.json()) as CreatomateRender
    const status = mapStatus(data.status)
    const progress = progressFromStatus(data.status, data.progress)

    // AUTO-REFUND (TAAFT feedback) — this legacy path debits upfront in
    // /api/render (ledger key `legacy-<renderId>`); when Creatomate reports
    // failed/cancelled, give the credit back. Idempotent: the RPC only claims
    // rows WHERE refunded_at IS NULL, so re-polls can never refund twice.
    let creditsRefunded = 0
    if (status === 'failed') {
      creditsRefunded = await refundRenderCredits(`legacy-${id}`)
    }

    return NextResponse.json({
      status,
      progress,
      url: data.url ?? null,
      creditsRefunded,
      error:
        status === 'failed'
          ? (data.error_message ?? 'Render failed.') +
            (creditsRefunded > 0 ? ` Your ${creditsRefunded} credit was automatically refunded.` : '')
          : undefined,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[render/id] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
