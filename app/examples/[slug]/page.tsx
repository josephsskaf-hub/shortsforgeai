import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ExampleCta from '../ExampleCta'
import ExampleVideoPlayer from '../ExampleVideoPlayer'
import { PUBLIC_EXAMPLES, getPublicExample } from '@/lib/publicExamples'

const BASE = 'https://www.usekineo.com'
const PUBLICATION_DATE = '2026-07-16T00:00:00.000Z'

export function generateStaticParams() {
  return PUBLIC_EXAMPLES.map((example) => ({ slug: example.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const example = getPublicExample(params.slug)
  if (!example) return {}

  const canonical = `${BASE}/examples/${example.slug}`
  return {
    title: `${example.title} | Kineo`,
    description: example.description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: example.title,
      description: example.description,
      url: canonical,
      type: 'video.other',
      images: [{ url: example.posterPath, width: 360, height: 640 }],
      videos: [{ url: example.videoPath, width: 360, height: 640, type: 'video/mp4' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: example.title,
      description: example.description,
      images: [example.posterPath],
    },
  }
}

export default function ExampleWatchPage({ params }: { params: { slug: string } }) {
  const example = getPublicExample(params.slug)
  if (!example) notFound()

  const canonical = `${BASE}/examples/${example.slug}`
  const generateHref = `/generate?prompt=${encodeURIComponent(example.prompt)}&utm_source=example_watch&utm_medium=proof&utm_campaign=push31&utm_content=${encodeURIComponent(example.slug)}`
  const pricingHref = `/pricing?utm_source=example_watch&utm_medium=proof&utm_campaign=push31&utm_content=${encodeURIComponent(example.slug)}`
  const videoObject = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: example.title,
    description: example.description,
    thumbnailUrl: [`${BASE}${example.posterPath}`],
    uploadDate: PUBLICATION_DATE,
    duration: `PT${example.previewDurationSeconds}S`,
    contentUrl: `${BASE}${example.videoPath}`,
    embedUrl: canonical,
  }

  return (
    <main className="min-h-screen bg-[#08080b] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoObject).replace(/</g, '\\u003c') }}
      />

      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="font-display text-lg font-black tracking-tight">Kineo</Link>
          <Link href="/examples" className="text-sm font-bold text-white/65 transition hover:text-white">All examples</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[minmax(300px,430px)_1fr] lg:items-center lg:py-16">
        <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[30px] border border-white/15 bg-black shadow-2xl shadow-cyan-950/20" style={{ aspectRatio: '9 / 16' }}>
          <ExampleVideoPlayer
            slug={example.slug}
            title={example.title}
            src={example.videoPath}
            poster={example.posterPath}
          />
        </div>

        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Real Kineo output · 5-second preview</p>
          <h1 className="mt-4 text-balance font-display text-4xl font-black tracking-tight sm:text-5xl">{example.title}</h1>
          <p className="mt-5 text-base leading-7 text-white/65">{example.description}</p>

          <dl className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <dt className="text-[10px] font-black uppercase tracking-wider text-white/45">Preview shown</dt>
              <dd className="mt-1 text-lg font-black">{example.previewDurationSeconds} seconds</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <dt className="text-[10px] font-black uppercase tracking-wider text-white/45">Original export</dt>
              <dd className="mt-1 text-lg font-black">{example.outputDurationSeconds} seconds</dd>
            </div>
          </dl>

          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Remix prompt</p>
            <p className="mt-2 text-sm leading-6 text-white/75">“{example.prompt}”</p>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <ExampleCta href={generateHref} slug={example.slug} target="generate">Make a Short from this prompt →</ExampleCta>
            <ExampleCta href={pricingHref} slug={example.slug} target="pricing" secondary>See pricing</ExampleCta>
          </div>

          <p className="mt-5 text-xs leading-5 text-white/40">
            This preview demonstrates Kineo’s output format, not view or revenue performance. Review factual claims before publishing generated content.
          </p>
        </div>
      </section>
    </main>
  )
}
