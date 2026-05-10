import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRunwayTask } from '@/lib/runway'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    if (!process.env.RUNWAY_API_KEY) {
      return NextResponse.json(
        { error: 'Video service is not configured.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const tasksParam = req.nextUrl.searchParams.get('tasks') ?? ''
    const ids = tasksParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Missing tasks parameter.' }, { status: 400 })
    }
    if (ids.length > 8) {
      return NextResponse.json({ error: 'Too many tasks requested.' }, { status: 400 })
    }

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          return await getRunwayTask(id)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return {
            id,
            status: 'FAILED' as const,
            progress: null,
            videoUrl: null,
            failure: msg,
          }
        }
      })
    )

    const done = results.every(
      (r) => r.status === 'SUCCEEDED' || r.status === 'FAILED' || r.status === 'CANCELLED'
    )
    const anyFailed = results.some((r) => r.status === 'FAILED' || r.status === 'CANCELLED')
    const succeeded = results.filter((r) => r.status === 'SUCCEEDED').length

    return NextResponse.json({
      done,
      anyFailed,
      succeeded,
      total: results.length,
      tasks: results,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-video/status] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Status lookup failed. Please retry.' },
      { status: 500 }
    )
  }
}
