import { createClient as createAdminClient } from '@supabase/supabase-js'
import Link from 'next/link'
import type { Metadata } from 'next'

// #459 — Public shareable video page (/v/[id]). Every generated video gets a
// public landing: the 9:16 player + a "make your own free" CTA. When a user
// shares their video, each share is a landing that brings a NEW visitor who has
// already SEEN the product working (warmer than cold traffic). Growth loop with
// zero video-render changes. Read uses the service-role client (videos table has
// RLS); only public-safe fields are selected — never user_id, script, etc.
export const dynamic = 'force-dynamic'

type VideoRow = {
  id: string
  title: string | null
  video_url: string | null
  thumbnail_url: string | null
  topic: string | null
  status: string | null
}

async function getVideo(id: string): Promise<VideoRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    const admin = createAdminClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await admin
      .from('videos')
      .select('id, title, video_url, thumbnail_url, topic, status')
      .eq('id', id)
      .single()
    return (data as VideoRow) ?? null
  } catch {
    return null
  }
}

function titleFor(v: VideoRow | null): string {
  if (!v) return 'AI YouTube Short'
  const raw = (v.title || v.topic || '').toString()
  // strip leading markdown "#" so a pasted markdown package doesn't surface as the title
  const firstLine = raw.split('\n').map((s) => s.replace(/^#+\s*/, '').trim()).filter(Boolean)[0] ?? ''
  return firstLine.slice(0, 90) || 'AI YouTube Short'
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const v = await getVideo(params.id)
  const title = titleFor(v)
  const desc = 'Made in 60 seconds with ShortsForgeAI — type any topic and AI writes the script, voiceover, captions and footage. Make your own viral Short for free.'
  // #462 — og:image is now produced by the sibling opengraph-image.tsx (a
  // generated, always-valid 1200x630 card). We don't set images here anymore —
  // the static fallback didn't exist, which broke every link preview.
  return {
    metadataBase: new URL('https://www.shortsforgeai.com'),
    title: `${title} · ShortsForgeAI`,
    description: desc,
    openGraph: {
      title,
      description: desc,
      videos: v?.video_url ? [{ url: v.video_url }] : undefined,
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
    },
  }
}

export default async function PublicVideoPage({ params }: { params: { id: string } }) {
  const v = await getVideo(params.id)
  const ready = !!(v && v.video_url && (v.status === 'completed' || v.status == null))
  const title = titleFor(v)

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#020D0A',
        color: '#F1F5F9',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px 48px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <Link
        href="/"
        style={{ alignSelf: 'flex-start', color: '#22D3EE', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}
      >
        ⚡ ShortsForgeAI
      </Link>

      <div style={{ width: '100%', maxWidth: 380, marginTop: 18 }}>
        {ready ? (
          <video
            src={v!.video_url!}
            poster={v!.thumbnail_url ?? undefined}
            controls
            playsInline
            style={{
              width: '100%',
              aspectRatio: '9 / 16',
              borderRadius: 18,
              background: '#000',
              border: '1px solid rgba(34,211,238,0.25)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              aspectRatio: '9 / 16',
              borderRadius: 18,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 20,
              color: '#94A3B8',
            }}
          >
            This video isn&apos;t available right now.
          </div>
        )}

        <h1 style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.3, marginTop: 16, textAlign: 'center' }}>
          {title}
        </h1>

        <div
          style={{
            marginTop: 20,
            padding: 18,
            borderRadius: 16,
            background: 'rgba(34,211,238,0.08)',
            border: '1px solid rgba(34,211,238,0.3)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>Made in ~60 seconds with AI 🤯</p>
          <p style={{ margin: '6px 0 14px', color: '#CBD5E1', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Type any topic — the AI writes the script, voiceover, captions and finds the footage. Your first one is free, no card needed.
          </p>
          <Link
            href="/signup?utm_source=public_video&utm_medium=share"
            style={{
              display: 'inline-block',
              background: '#22D3EE',
              color: '#020D0A',
              fontWeight: 900,
              padding: '13px 26px',
              borderRadius: 12,
              textDecoration: 'none',
              fontSize: '1rem',
            }}
          >
            Make my own free →
          </Link>
        </div>
      </div>
    </main>
  )
}
