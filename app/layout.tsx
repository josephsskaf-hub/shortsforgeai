import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import StructuredData from '@/components/StructuredData'
import './globals.css'

// Push #117 — explicit viewport so iOS Safari renders pages at the
// device width (not 980px-zoomed-out) and the 16px input rule below
// can do its job. maximum-scale: 5 keeps pinch-to-zoom for
// accessibility — never lock it to 1.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // Push #422 — PWA: paints the iOS/Android browser chrome in the brand
  // dark so the installed app feels native edge-to-edge.
  themeColor: '#0d0d14',
}

// Push #297 — meta title + description rewritten for Google Ads Quality
// Score alignment. Matching keyword density between ad copy and landing
// page increases relevance score → better Ad Rank → higher CTR.
export const metadata: Metadata = {
  title: 'Kineo — AI YouTube Shorts Generator · From $9.90/mo',
  description:
    'Turn any topic into a viral YouTube Short in 60 seconds. AI writes the script, finds footage, adds voiceover & captions. From $9.90/mo · 7-day money-back guarantee.',
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
      'Type a topic. AI writes, voices & edits your YouTube Short automatically. From $9.90/mo · 7-day money-back guarantee · No editing skills needed.',
    url: 'https://www.usekineo.com',
    siteName: 'Kineo',
    images: [
      {
        url: 'https://www.usekineo.com/og-image.png',
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
      'Type a topic. AI writes, voices & edits your YouTube Short in 60 seconds. From $9.90/mo · Try free today.',
    images: ['https://www.usekineo.com/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    // Push #422 — real PNG for iOS home screen (Safari ignores SVG here
    // and would fall back to a screenshot-gray tile).
    apple: '/apple-touch-icon.png',
  },
  // Push #422 — PWA: lets the installed web app run full-screen on iOS
  // ("Add to Home Screen") with a black-translucent status bar.
  appleWebApp: {
    capable: true,
    title: 'Kineo',
    statusBarStyle: 'black-translucent',
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
        {/* #375 — TikTok Pixel base code (Pixel ID D8EJ1S3C77U8POE02SBG).
            Fires PageView automatically via ttq.page(). CompleteRegistration
            is tracked on signup, Purchase on checkout success. */}
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

              ttq.load('D8EJ1S3C77U8POE02SBG');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
        {/* #481 — Rewardful affiliate tracking. The queue snippet defines
            window.rewardful; rw.js (async) captures the ?via=CODE referral and
            sets a 60-day first-party cookie. The 'ready' callback mirrors the
            referral id into a server-readable cookie so /api/stripe/checkout can
            pass it to Stripe as client_reference_id. API key 55bff9 is public. */}
        <Script id="rewardful-queue" strategy="afterInteractive">
          {`(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`}
        </Script>
        <Script async src="https://r.wdfl.co/rw.js" data-rewardful="55bff9" strategy="afterInteractive" />
        <Script id="rewardful-cookie" strategy="afterInteractive">
          {`
            window.rewardful && window.rewardful('ready', function(){
              try {
                if (window.Rewardful && window.Rewardful.referral) {
                  document.cookie = 'rewardful_referral=' + window.Rewardful.referral + ';path=/;max-age=5184000;samesite=lax;secure';
                }
              } catch (e) {}
            });
          `}
        </Script>
      </head>
      <body><StructuredData />{children}</body>
    </html>
  )
}
