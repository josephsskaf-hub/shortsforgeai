import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kineo Pricing — Starter $4.90 First Month',
  description:
    'Compare Kineo Starter, Creator and Studio. Create up to 3 watermarked Fast videos every 24h with no card. Starter is $4.90 for the first month, then $9.90/month. Cancel anytime.',
  alternates: { canonical: 'https://www.usekineo.com/pricing' },
  openGraph: {
    title: 'Kineo Pricing — Starter $4.90 First Month',
    description:
      'Create up to 3 watermarked Fast videos every 24h with no card. Starter is $4.90 for the first month, then $9.90/month.',
    url: 'https://www.usekineo.com/pricing',
    siteName: 'Kineo',
    images: ['/og-image.png'],
    type: 'website',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
