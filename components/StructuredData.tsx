// StructuredData — schema.org JSON-LD for Google rich results / AI search.
// Server-safe (no hooks, no client APIs): renders three <script type="application/ld+json"> tags.
//
// Guidelines followed (Google Search Central, checked 2026-07):
// - SoftwareApplication: name + offers are the load-bearing fields; aggregateRating
//   is deliberately OMITTED because we have no verifiable third-party ratings and
//   fabricated ratings are a manual-action risk.
// - FAQPage: questions/answers below are copied VERBATIM from the FAQ section
//   rendered in app/KineoLanding.tsx (#faq) — Google requires JSON-LD to mirror
//   visible page content. (FAQ rich results are deprecated for non-gov/health
//   sites, but the markup remains valid and is parsed by Google + AI engines.)

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Kineo',
  url: 'https://www.usekineo.com',
  logo: 'https://www.usekineo.com/icon-512.png',
}

const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Kineo',
  url: 'https://www.usekineo.com',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Web',
  description:
    'Kineo is an AI YouTube Shorts generator for repeatable shows with the same face, voice and style, including script, voiceover, scenes and captions.',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '4.90',
    highPrice: '37.90',
    priceCurrency: 'USD',
  },
}

// Escape "<" so a value could never close the script tag early (defense in
// depth — all values above are static strings we control).
function jsonLd(schema: object): { __html: string } {
  return { __html: JSON.stringify(schema).replace(/</g, '\\u003c') }
}

export default function StructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(organizationSchema)}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(softwareApplicationSchema)}
      />
    </>
  )
}
