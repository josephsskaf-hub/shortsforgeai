import type { Metadata } from 'next'
import Script from 'next/script'
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
