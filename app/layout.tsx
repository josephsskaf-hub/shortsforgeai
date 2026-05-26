import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'

// Push #117 — explicit viewport so iOS Safari renders pages at the
// device width (not 980px-zoomed-out) and the 16px input rule below
// can do its job. maximum-scale: 5 keeps pinch-to-zoom for
// accessibility — never lock it to 1.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

// Push #297 — meta title + description rewritten for Google Ads Quality
// Score alignment. Matching keyword density between ad copy and landing
// page increases relevance score → better Ad Rank → higher CTR.
export const metadata: Metadata = {
  title: 'ShortsForgeAI — AI YouTube Shorts Generator · From $4.90/mo',
  description:
    'Turn any topic into a viral YouTube Short in 60 seconds. AI writes the script, finds footage, adds voiceover & captions. From $4.90/mo · 7-day money-back guarantee.',
  keywords: [
    'YouTube Shorts generator',
    'AI YouTube Shorts creator',
    'AI short video generator',
    'make YouTube Shorts automatically',
    'YouTube Shorts maker AI',
    'AI video generator',
    'viral shorts creator',
    'YouTube automation tool',
    'short form video AI',
  ],
  openGraph: {
    title: 'AI YouTube Shorts Generator — Script, Footage & Voice in 60s',
    description:
      'Type a topic. AI writes, voices & edits your YouTube Short automatically. From $4.90/mo · 7-day money-back guarantee · No editing skills needed.',
    url: 'https://shortsforgeai.vercel.app',
    siteName: 'ShortsForgeAI',
    images: [
      {
        url: 'https://shortsforgeai.vercel.app/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI YouTube Shorts Generator — Script, Footage & Voice in 60s',
    description:
      'Type a topic. AI writes, voices & edits your YouTube Short in 60 seconds. From $4.90/mo · Try free today.',
    images: ['https://shortsforgeai.vercel.app/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18156258081"
          strategy="afterInteractive"
        />
        <Script id="google-ads-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18156258081');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  )
}
