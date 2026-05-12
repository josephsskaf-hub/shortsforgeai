import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ShortsForgeAI | AI Video Generator',
  description:
    'AI-powered video generator for YouTube Shorts, TikTok, and Instagram Reels. Create cinematic faceless AI Shorts in minutes.',
  keywords: 'ai video generator, youtube shorts, tiktok video, instagram reels, faceless video, ai shorts',
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
