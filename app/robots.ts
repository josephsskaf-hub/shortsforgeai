import type { MetadataRoute } from 'next'

// #458 — SEO: robots.txt so crawlers know what to index and where the sitemap
// is. Allows the public marketing pages; keeps the API, the app/dashboard and
// checkout out of the index (they shouldn't rank and waste crawl budget).
const BASE = 'https://www.usekineo.com'

// AEO/GEO — explicit allow groups for AI answer-engine crawlers so Kineo stays
// eligible for citations in ChatGPT, Claude, Perplexity and Google AI answers.
// Two bot families per provider: training crawlers (GPTBot, ClaudeBot,
// Google-Extended, CCBot) put us in the models' knowledge; search/RAG crawlers
// (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot,
// Perplexity-User) make us citable at query time. Both are welcome. Same
// disallow list as '*' so app/API surfaces stay out of answers too.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'CCBot',
]

const DISALLOW = ['/api/', '/generate', '/history', '/checkout/', '/admin', '/v2', '/create']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
      {
        userAgent: AI_CRAWLERS,
        allow: '/',
        disallow: DISALLOW,
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
