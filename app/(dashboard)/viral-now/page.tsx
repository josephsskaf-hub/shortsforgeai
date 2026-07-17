// PUSH #39 — crawlable acquisition page with auth-safe topic handoff.
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getViralNowTopics } from '@/lib/viralTopics'
import ViralNowClient from './ViralNowClient'

const VIRAL_NOW_URL = 'https://www.usekineo.com/viral-now'
const TITLE = 'Viral Now: Trending YouTube Shorts Ideas Today | Kineo'
const DESCRIPTION =
  'See 8 trending YouTube Shorts ideas, refreshed every 4 hours. Pick a topic and create a free watermarked faceless Short with AI—no card required.'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.usekineo.com'),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: VIRAL_NOW_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: VIRAL_NOW_URL,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default async function ViralNowPage() {
  const supabase = createClient()
  const [{ data: { user } }, topics] = await Promise.all([
    supabase.auth.getUser(),
    Promise.resolve(getViralNowTopics()),
  ])
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Trending YouTube Shorts ideas today',
    numberOfItems: topics.length,
    itemListElement: topics.map((topic, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'CreativeWork',
        name: topic.title,
        description: topic.description,
        url: `${VIRAL_NOW_URL}#topic-${topic.id}`,
      },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c') }}
      />
      <ViralNowClient isLoggedIn={Boolean(user)} initialTopics={topics} />
    </>
  )
}
