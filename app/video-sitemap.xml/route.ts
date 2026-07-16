import { PUBLIC_EXAMPLES } from '@/lib/publicExamples'

const BASE = 'https://www.usekineo.com'
const PUBLICATION_DATE = '2026-07-16T00:00:00.000Z'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const entries = PUBLIC_EXAMPLES.map((example) => `  <url>
    <loc>${escapeXml(`${BASE}/examples/${example.slug}`)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(`${BASE}${example.posterPath}`)}</video:thumbnail_loc>
      <video:title>${escapeXml(example.title)}</video:title>
      <video:description>${escapeXml(example.description)}</video:description>
      <video:content_loc>${escapeXml(`${BASE}${example.videoPath}`)}</video:content_loc>
      <video:duration>${example.previewDurationSeconds}</video:duration>
      <video:publication_date>${PUBLICATION_DATE}</video:publication_date>
    </video:video>
  </url>`).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries}
</urlset>
`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=3600',
    },
  })
}
