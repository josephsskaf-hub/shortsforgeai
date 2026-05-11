import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ShortsForgeAI — Create 5 Viral Shorts in 30 Seconds',
  description:
    'AI-powered viral short-form content generator for YouTube Shorts, TikTok, and Instagram Reels. Pick a niche, get 5 ready-to-post scripts instantly.',
  keywords: 'viral shorts, youtube shorts generator, ai content creator, tiktok scripts',
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
      <body>{children}</body>
    </html>
  )
}
