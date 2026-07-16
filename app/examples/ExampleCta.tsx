'use client'

import Link from 'next/link'

interface ExampleCtaProps {
  href: string
  slug: string
  target: 'generate' | 'pricing'
  children: React.ReactNode
  secondary?: boolean
}

export default function ExampleCta({ href, slug, target, children, secondary = false }: ExampleCtaProps) {
  function trackClick() {
    try {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'example_watch_cta_click',
          path: window.location.pathname,
          metadata: {
            version: 'push31',
            example_slug: slug,
            target,
          },
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // Analytics must never block navigation.
    }
  }

  return (
    <Link
      href={href}
      onClick={trackClick}
      className={
        secondary
          ? 'rounded-full border border-white/15 px-5 py-3 text-center text-sm font-bold text-white transition hover:border-white/35 hover:bg-white/5'
          : 'rounded-full bg-white px-5 py-3 text-center text-sm font-black text-black transition hover:bg-cyan-200'
      }
    >
      {children}
    </Link>
  )
}
