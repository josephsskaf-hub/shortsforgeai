import { ImageResponse } from 'next/og'

// KINEO-OG-FIX-2026-07-13 — layout.tsx aponta og:image + twitter:image pra
// https://www.usekineo.com/og-image.png, mas o arquivo nunca existiu em /public
// → TODO share da home (WhatsApp, X, Slack, Product Hunt) saía SEM card.
// Esta rota serve um PNG 1200x630 brandado exatamente nessa URL, então todas
// as referências existentes passam a funcionar sem tocar em metadata.
// (public/ não entra no PUSH_KINEO.bat — por isso rota em app/, não estático.)
export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#000',
          padding: '64px 70px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              width: 58,
              height: 58,
              borderRadius: 14,
              background: '#2563eb',
              color: '#fff',
              fontSize: 36,
              fontWeight: 800,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            K
          </div>
          <div style={{ display: 'flex', color: '#2997ff', fontSize: 46, fontWeight: 800 }}>
            Kineo
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              color: '#F1F5F9',
              fontSize: 66,
              fontWeight: 800,
              lineHeight: 1.12,
            }}
          >
            Type an idea. Get a finished Short.
          </div>
          <div style={{ display: 'flex', color: '#94a3b8', fontSize: 34, fontWeight: 600 }}>
            AI script · locked AI host · voiceover · captions — in a few minutes
          </div>
        </div>
        <div style={{ display: 'flex', color: '#86868b', fontSize: 30, fontWeight: 600 }}>
          usekineo.com · 3 watermarked Fast videos / 24h · paid = clean MP4
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    },
  )
}
