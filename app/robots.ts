import type { MetadataRoute } from 'next'

// #458 — SEO: robots.txt so crawlers know what to index and where the sitemap
// is. Allows the public marketing pages; keeps the API, the app/dashboard and
// checkout out of the index (they shouldn't rank and waste crawl budget).
const BASE = 'https://www.shortsforgeai.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/generate', '/history', '/checkout/', '/admin', '/v2', '/create'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
