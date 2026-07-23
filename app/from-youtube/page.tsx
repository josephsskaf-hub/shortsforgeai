import type { Metadata } from 'next'
import Link from 'next/link'
import ExampleVideoPlayer from '@/app/examples/ExampleVideoPlayer'
import { createClient } from '@/lib/supabase/server'
import { PUBLIC_EXAMPLES } from '@/lib/publicExamples'
import YouTubeBridgeClient from './YouTubeBridgeClient'

// The legacy Darvaza preview was produced from an older script. Keep the live
// proof factual by showing a different founder-owned export until today's
// corrected Darvaza asset replaces it.
const FEATURED_EXAMPLE = PUBLIC_EXAMPLES[1]
const DEMO_PROMPT =
  'Why satellite records suggest Turkmenistan\'s Door to Hell began burning in 1987–88 — not 1971'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Make a Faceless Short From One Topic | Kineo',
  description:
    'Type one topic and Kineo builds the script, AI voiceover, matched footage and captions for a vertical faceless Short.',
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Turn one topic into a finished faceless Short',
    description: 'No camera and no timeline. Try the screen-only Kineo workflow with your own topic.',
    type: 'website',
    images: [{ url: FEATURED_EXAMPLE.posterPath, width: 360, height: 640 }],
  },
}

export default async function FromYouTubePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-[#07070a] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="font-display text-lg font-black tracking-tight">
            Kineo
          </Link>
          <span className="text-xs font-bold text-white/45">AI Shorts · no camera</span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            You watched the screen-only workflow
          </p>
          <h1 className="mt-4 text-balance font-display text-4xl font-black tracking-tight sm:text-6xl">
            Turn your next topic into a finished faceless Short.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
            Type one idea. Kineo builds the script, AI voiceover, matched footage and
            captions into a vertical video — usually in 2–4 minutes.
          </p>
        </div>

        <div className="mt-10 grid gap-7 lg:grid-cols-[minmax(280px,0.82fr)_minmax(380px,1.18fr)] lg:items-center">
          <div className="order-2 mx-auto w-full max-w-[330px] lg:order-1">
            <div
              className="overflow-hidden rounded-[28px] border border-white/15 bg-black shadow-2xl shadow-cyan-950/20"
              style={{ aspectRatio: '9 / 16' }}
            >
              <ExampleVideoPlayer
                slug={FEATURED_EXAMPLE.slug}
                title={FEATURED_EXAMPLE.title}
                src={FEATURED_EXAMPLE.videoPath}
                poster={FEATURED_EXAMPLE.posterPath}
                placement="screen_demo_bridge"
                version="push55"
              />
            </div>
            <p className="mt-3 text-center text-xs leading-5 text-white/40">
              Another real five-second preview from a {FEATURED_EXAMPLE.outputDurationSeconds}-second Kineo export.
            </p>
          </div>

          <YouTubeBridgeClient
            isSignedIn={Boolean(user)}
            initialPrompt={DEMO_PROMPT}
          />
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
          {[
            ['1', 'Type one topic', 'A fact, mystery, money idea or a script you already wrote.'],
            ['2', 'AI builds every layer', 'Hook-led script, voiceover, footage and one readable caption track.'],
            ['3', 'Download and post', 'Get a 9:16 MP4 for YouTube Shorts, TikTok or Reels.'],
          ].map(([number, title, body]) => (
            <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-300/10 text-sm font-black text-cyan-300">
                {number}
              </div>
              <h2 className="mt-4 font-black">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">{body}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-white/40">
          Free Fast exports include a Kineo watermark. Starter is $4.90 for the first
          month and renews at $9.90/month. Cancel anytime; a 7-day money-back guarantee applies.
        </p>
      </section>
    </main>
  )
}
