import type { Metadata } from 'next'
import Link from 'next/link'
import ExampleVideoPlayer from '@/app/examples/ExampleVideoPlayer'
import { createClient } from '@/lib/supabase/server'
import { PUBLIC_EXAMPLES } from '@/lib/publicExamples'
import SaaSHubBridgeClient from './SaaSHubBridgeClient'

const FEATURED_EXAMPLE = PUBLIC_EXAMPLES[1]

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Create a Faceless AI Short From One Idea | Kineo',
  description:
    'Kineo turns one idea into a ready-to-post vertical Short with script, AI voiceover, matched visuals, captions, and MP4 export.',
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Turn one idea into a finished faceless Short',
    description: 'Try the complete Kineo workflow with no camera, timeline, or credit card.',
    type: 'website',
    images: [{ url: FEATURED_EXAMPLE.posterPath, width: 360, height: 640 }],
  },
}

export default async function FromSaaSHubPage() {
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
          <span className="text-xs font-bold text-white/45">AI Shorts · no camera · no card</span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
            You found Kineo on SaaSHub
          </p>
          <h1 className="mt-4 text-balance font-display text-4xl font-black tracking-tight sm:text-6xl">
            One idea in. A finished faceless Short out.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
            Kineo writes the hook-led script, generates the AI voiceover, matches
            visuals to every scene, adds captions, and exports a vertical MP4.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-bold text-white/55">
            {['No source video', 'No camera', 'No editing timeline', 'No card for Fast'].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-7 lg:grid-cols-[minmax(280px,0.82fr)_minmax(380px,1.18fr)] lg:items-center">
          <div className="mx-auto w-full max-w-[330px]">
            <div
              className="overflow-hidden rounded-[28px] border border-white/15 bg-black shadow-2xl shadow-blue-950/20"
              style={{ aspectRatio: '9 / 16' }}
            >
              <ExampleVideoPlayer
                slug={FEATURED_EXAMPLE.slug}
                title={FEATURED_EXAMPLE.title}
                src={FEATURED_EXAMPLE.videoPath}
                poster={FEATURED_EXAMPLE.posterPath}
                placement="saashub_directory_bridge"
                version="push65"
              />
            </div>
            <p className="mt-3 text-center text-xs leading-5 text-white/40">
              A real five-second preview from a {FEATURED_EXAMPLE.outputDurationSeconds}-second Kineo export.
            </p>
          </div>

          <SaaSHubBridgeClient isSignedIn={Boolean(user)} />
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
          {[
            ['From scratch', 'Unlike clip cutters, Kineo starts from a topic. You do not need a long video first.'],
            ['Ready to post', 'Script, voice, visuals, captions and a 9:16 MP4 are created in one workflow.'],
            ['Clear pricing', 'Starter is $4.90 for month one, then $9.90/month. Cancel anytime.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h2 className="font-black">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">{body}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-white/40">
          Free Fast exports include a Kineo watermark. Paid plans unlock clean MP4s and premium AI engines.
          Starter renews at $9.90/month after the $4.90 first month; a 7-day money-back guarantee applies.
        </p>
      </section>
    </main>
  )
}
