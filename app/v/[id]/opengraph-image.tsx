import { ImageResponse } from 'next/og'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// #462 — dynamically generated OG preview image for /v/[id]. The static
// og-image.png fallback didn't exist, so WhatsApp/Twitter showed no card at all.
// This route ALWAYS produces a valid 1200x630 PNG (branded card + the video's
// hook as the headline), so every shared video link renders a rich preview.
export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'A viral Short made with ShortsForgeAI'

async function getTitle(id: string): Promise<string> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return 'AI YouTube Short'
    const admin = createAdminClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await admin.from('videos').select('title, topic').eq('id', id).single()
    const raw = ((data?.title || data?.topic || '') as string)
    const line =
      raw
        .split('\n')
        .map((s) => s.replace(/^#+\s*/, '').trim())
        .filter(Boolean)[0] ?? ''
    return line.slice(0, 110) || 'AI YouTube Short'
  } catch {
    return 'AI YouTube Short'
  }
}

export default async function OgImage({ params }: { params: { id: string } }) {
  const title = await getTitle(params.id)
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#020D0A',
          padding: '64px 70px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', color: '#22D3EE', fontSize: 40, fontWeight: 800 }}>
          ShortsForgeAI
        </div>
        <div style={{ display: 'flex', color: '#F1F5F9', fontSize: 60, fontWeight: 800, lineHeight: 1.18 }}>
          {title}
        </div>
        <div style={{ display: 'flex', color: '#94A3B8', fontSize: 32, fontWeight: 600 }}>
          Made in ~60 seconds with AI — make your own free
        </div>
      </div>
    ),
    { ...size },
  )
}
