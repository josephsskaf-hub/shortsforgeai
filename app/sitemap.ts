import type { MetadataRoute } from 'next'
import { NICHE_SLUGS } from './free-ai-shorts/[niche]/page'
import { COMPETITOR_SLUGS } from './alternatives/[competitor]/page'

// #458 — SEO: sitemap so Google can discover and index every public page.
// The site had none, so search engines were barely crawling it — free organic
// traffic left on the table. Canonical domain = the live www host.
const BASE = 'https://www.shortsforgeai.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes: { path: string; priority: number; freq: 'daily' | 'weekly' | 'monthly' }[] = [
    { path: '', priority: 1.0, freq: 'daily' },
    { path: '/pricing', priority: 0.9, freq: 'weekly' },
    { path: '/pt', priority: 0.9, freq: 'weekly' },
    { path: '/start', priority: 0.8, freq: 'weekly' },
    { path: '/signup', priority: 0.7, freq: 'monthly' },
    { path: '/login', priority: 0.4, freq: 'monthly' },
    { path: '/referral', priority: 0.5, freq: 'monthly' },
    { path: '/terms', priority: 0.2, freq: 'monthly' },
    { path: '/privacy', priority: 0.2, freq: 'monthly' },
  ]
  const staticEntries = routes.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }))
  // #478 — programmatic SEO niche landing pages (/free-ai-shorts/[niche]).
  const nicheEntries = NICHE_SLUGS.map((slug) => ({
    url: `${BASE}/free-ai-shorts/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
  // #482 — comparison / "X alternative" SEO pages (/alternatives/[competitor]).
  const altEntries = COMPETITOR_SLUGS.map((slug) => ({
    url: `${BASE}/alternatives/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
  return [...staticEntries, ...nicheEntries, ...altEntries]
}
