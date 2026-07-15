import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kineo Pricing — AI YouTube Shorts From $9.90/mo',
  description:
    'Compare Kineo Starter, Creator and Studio. Make your first AI Short free, then choose a monthly plan from $9.90. Cancel anytime.',
  alternates: { canonical: 'https://www.usekineo.com/pricing' },
  openGraph: {
    title: 'Kineo Pricing — AI YouTube Shorts From $9.90/mo',
    description:
      'Make your first AI Short free, then choose the monthly Kineo plan that fits your workflow.',
    url: 'https://www.usekineo.com/pricing',
    siteName: 'Kineo',
    images: ['/og-image.png'],
    type: 'website',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
