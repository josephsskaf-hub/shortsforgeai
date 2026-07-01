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
    'Kineo is an AI YouTube Shorts generator that turns any topic into a finished vertical video — script, voiceover, footage and captions — in about 60 seconds.',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '4.90',
    highPrice: '37.90',
    priceCurrency: 'USD',
  },
}

// Mirrors the #faq section in app/KineoLanding.tsx — keep both in sync if the
// visible FAQ ever changes.
const faqPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is the video really mine to post?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Everything Kineo makes is yours — download the MP4 and post it to YouTube, TikTok or Reels, monetize it, whatever you want.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need any editing skills?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'None. You type one idea and the AI writes the script, records the voice, finds the footage and adds captions. You just download.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is there a watermark?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Paid plans export clean, watermark-free MP4s. The free trial adds a small mark so you can test the output first.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I use my own script?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes — paste your script and pick “Use my script as is” and the AI narrates it word for word.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I cancel anytime?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Anytime, in one click. Plans are month to month and your credits never expire.',
      },
    },
  ],
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(faqPageSchema)}
      />
    </>
  )
}
