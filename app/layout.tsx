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

export const metadata: Metadata = {
  title: 'ShortsForgeAI — Turn Ideas Into Viral YouTube Shorts in 60 Seconds',
  description:
    'AI-powered YouTube Shorts generator. Write a topic, get a fully edited Short with voiceover, footage, and captions. Free to try.',
  keywords: [
    'YouTube Shorts',
    'AI video generator',
    'short form video',
    'YouTube automation',
    'viral shorts',
  ],
  openGraph: {
    title: 'ShortsForgeAI — Viral YouTube Shorts in 60 Seconds',
    description:
      'AI writes, voices, and edits your YouTube Shorts automatically. Join 500+ creators. 2 free videos, no credit card.',
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
    title: 'ShortsForgeAI — Viral YouTube Shorts in 60 Seconds',
    description:
      'AI writes, voices, and edits your YouTube Shorts. Free to try.',
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
