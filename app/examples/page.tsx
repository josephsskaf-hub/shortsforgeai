import type { Metadata } from 'next'
import Link from 'next/link'
import { PUBLIC_EXAMPLES } from '@/lib/publicExamples'

export const metadata: Metadata = {
  title: 'Real AI Shorts Examples | Kineo',
  description:
    'Watch honest previews cut from real faceless Shorts created with Kineo, then remix the exact format with your own topic.',
  alternates: { canonical: 'https://www.usekineo.com/examples' },
  openGraph: {
    title: 'Real AI Shorts Examples | Kineo',
    description: 'Watch real Kineo output previews and start from the same production format.',
    url: 'https://www.usekineo.com/examples',
    images: [{ url: '/videos/example-turkmenistan.jpg', width: 360, height: 640 }],
  },
}

export default function ExamplesPage() {
  return (
    <main className="min-h-screen bg-[#08080b] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="font-display text-lg font-black tracking-tight">Kineo</Link>
          <nav className="flex items-center gap-4 text-sm font-bold text-white/70">
            <Link href="/pricing" className="transition hover:text-white">Pricing</Link>
            <Link href="/signup?utm_source=examples&amp;utm_medium=proof&amp;utm_campaign=push31" className="rounded-full bg-white px-4 py-2 text-black transition hover:bg-cyan-200">
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pt-20">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Real product proof</p>
          <h1 className="mt-4 text-balance font-display text-4xl font-black tracking-tight sm:text-6xl">
            Watch what Kineo actually makes.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
            These are five-second preview cuts from longer Kineo exports—not stock mockups and not performance claims. Open one to watch, inspect the format and remix the prompt.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PUBLIC_EXAMPLES.map((example) => (
            <Link
              key={example.slug}
              href={`/examples/${example.slug}`}
              className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition hover:-translate-y-1 hover:border-cyan-300/50"
            >
              <div className="relative aspect-[9/16] overflow-hidden bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={example.posterPath}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/10" />
                <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur">
                  Real output preview
                </span>
                <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-lg text-black shadow-2xl transition group-hover:scale-110" aria-hidden>
                  ▶
                </span>
                <div className="absolute inset-x-4 bottom-4">
                  <p className="text-lg font-black leading-tight">{example.shortTitle}</p>
                  <p className="mt-1 text-xs font-semibold text-white/65">
                    5s preview · {example.outputDurationSeconds}s export
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.055] p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h2 className="text-xl font-black">Bring your own topic.</h2>
            <p className="mt-1 text-sm leading-6 text-white/60">Try up to three watermarked Fast videos every 24 hours. No card required.</p>
          </div>
          <Link
            href="/generate?utm_source=examples&amp;utm_medium=proof&amp;utm_campaign=push31"
            className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-cyan-200 sm:mt-0"
          >
            Create a Fast video →
          </Link>
        </div>
      </section>
    </main>
  )
}
