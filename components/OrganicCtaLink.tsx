'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { trackEvent } from '@/lib/analytics'

type OrganicCtaLinkProps = {
  href: string
  source: string
  placement: string
  children: ReactNode
  className?: string
  style?: CSSProperties
}

// PUSH #22 — one event name for every organic landing CTA. The destination
// carries the campaign through signup/OAuth; this click event also measures
// interest from visitors who leave before creating an account.
export default function OrganicCtaLink({
  href,
  source,
  placement,
  children,
  className,
  style,
}: OrganicCtaLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={() => {
        void trackEvent('organic_cta_clicked', {
          source,
          placement,
          destination: href.split('?')[0],
        })
      }}
    >
      {children}
    </Link>
  )
}
