'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'
import { trackEvent } from '@/lib/analytics'

type Props = {
  placement: string
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export default function CostCalculatorLink({ placement, children, className, style }: Props) {
  const pathname = usePathname() || '/'
  const href = `/cheapest-ai-shorts-maker?internal_source=${encodeURIComponent(pathname)}#short-cost-calculator-title`

  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={() => {
        void trackEvent('cost_calculator_internal_clicked', {
          from_path: pathname,
          placement,
          destination: '/cheapest-ai-shorts-maker',
          intent_campaign: 'push77_short_cost_calculator',
        })
      }}
    >
      {children}
    </Link>
  )
}
