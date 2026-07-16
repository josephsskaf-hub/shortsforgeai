'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { trackEvent } from '@/lib/analytics'

type PublicVideoCtaLinkProps = {
  href: string
  videoId: string
  children: ReactNode
  style?: CSSProperties
}

// PUSH #23 — measures the public-video landing → signup-intent step before
// navigation. The signup URL already preserves first-touch UTM/referral data.
export default function PublicVideoCtaLink({
  href,
  videoId,
  children,
  style,
}: PublicVideoCtaLinkProps) {
  return (
    <Link
      href={href}
      style={style}
      onClick={() => {
        void trackEvent('public_video_cta_clicked', {
          video_id: videoId,
          destination: '/signup',
        })
      }}
    >
      {children}
    </Link>
  )
}
