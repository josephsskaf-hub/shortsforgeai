import type { MetadataRoute } from 'next'
import { NICHE_SLUGS } from './free-ai-shorts/[niche]/page'
import { COMPETITOR_SLUGS } from './alternatives/[competitor]/page'
import { PT_SLUGS } from './pt/[slug]/page'

// #458 — SEO: sitemap so Google can discover and index every public page.
// The site had none, so search engines were barely crawling it — free organic
// traffic left on the table. Canonical domain = the live www host.
const BASE = 'https://www.usekineo.com'
// Advance this only when the public acquisition cluster materially changes.
// Using the request time for every URL makes lastModified meaningless.
const LAST_MODIFIED = new Date('2026-07-16T00:00:00.000Z')

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number; freq: 'daily' | 'weekly' | 'monthly' }[] = [
    { path: '', priority: 1.0, freq: 'daily' },
    { path: '/pricing', priority: 0.9, freq: 'weekly' },
    { path: '/pt', priority: 0.9, freq: 'weekly' },
    { path: '/free-script-generator', priority: 0.8, freq: 'weekly' },
    { path: '/free-hook-generator', priority: 0.8, freq: 'weekly' },
    { path: '/viral-score', priority: 0.8, freq: 'weekly' },
    { path: '/ai-avatar', priority: 0.8, freq: 'weekly' },
    { path: '/partners', priority: 0.7, freq: 'weekly' },
    { path: '/youtube-shorts-from-topic', priority: 0.8, freq: 'weekly' },
    { path: '/cheapest-ai-shorts-maker', priority: 0.8, freq: 'weekly' },
    { path: '/ai-shorts-without-filming', priority: 0.8, freq: 'weekly' },
    { path: '/faceless-channel-ideas', priority: 0.8, freq: 'weekly' },
    { path: '/free-ai-shorts', priority: 0.8, freq: 'weekly' },
    { path: '/alternatives', priority: 0.8, freq: 'weekly' },
    // AEO/GEO — citable fact sheet for AI answer engines (linked in public/llms.txt).
    { path: '/facts', priority: 0.7, freq: 'weekly' },
    { path: '/terms', priority: 0.2, freq: 'monthly' },
    { path: '/privacy', priority: 0.2, freq: 'monthly' },
  ]
  const staticEntries = routes.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: r.freq,
    priority: r.priority,
  }))
  // #478 — programmatic SEO niche landing pages (/free-ai-shorts/[niche]).
  const nicheEntries = NICHE_SLUGS.map((slug) => ({
    url: `${BASE}/free-ai-shorts/${slug}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
  // #482 — comparison / "X alternative" SEO pages (/alternatives/[competitor]).
  const altEntries = COMPETITOR_SLUGS.map((slug) => ({
    url: `${BASE}/alternatives/${slug}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
  // #487 — Portuguese SEO pages (/pt/[slug]).
  const ptEntries = PT_SLUGS.map((slug) => ({
    url: `${BASE}/pt/${slug}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
  return [...staticEntries, ...nicheEntries, ...altEntries, ...ptEntries]
}
