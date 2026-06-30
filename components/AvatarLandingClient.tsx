'use client'

// AI Avatar sales landing (/ai-avatar) — a focused page built to SELL the
// premium add-on: hero + live demo + how-it-works + pricing (current packs)
// + launch urgency + FAQ + CTA. Self-contained and additive (no edits to the
// generator/checkout). Shareable link for email, DMs and social. Emerald
// avatar palette to match the in-app components.
import { useState } from 'react'
import AvatarDemoLoop from '@/components/AvatarDemoLoop'

// Keep in sync with AVATAR_PACKS in app/api/stripe/checkout/route.ts.
const PACKS = [
  { id: 'avatar1', videos: 1, usd: 11.9, per: '11.90', tag: null as string | null },
  { id: 'avatar3', videos: 3, usd: 29.9, per: '9.97', tag: 'Popular' },
  { id: 'avatar10', videos: 10, usd: 79.9, per: '7.99', tag: 'Best value' },
]

const FAQ = [
  { q: 'How real does it look?', a: '720p lip-synced video — the person’s mouth matches your script word for word, with b-roll, captions and music around it.' },
  { q: 'Whose photo can I use?', a: 'Yours, or anyone’s with their permission. One sharp, front-facing photo works best. You confirm you have the right to use it on upload.' },
  { q: 'How long does it take?', a: 'About a minute of your time, a few minutes of rendering. No camera, no mic, no editing.' },
  { q: 'Do Avatar Credits expire?', a: 'No. They’re a one-time purchase, separate from your plan credits, and never expire.' },
  { q: 'What if a render fails?', a: 'You’re never charged for a failed render. Your credit stays in your balance.' },
]

export default function AvatarLandingClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <main style={{ background: '#05070d', color: '#e2e8f0', minHeight: '100vh' }}>
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-5" style={{ background: 'rgba(41,151,255,0.14)', border: '1px solid rgba(41,151,255,0.4)' }}>
          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#2997ff' }}>New · AI Avatar</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight" style={{ color: '#f0fdfa' }}>
          Your face, speaking any script.<br />No camera. No editing.
        </h1>
        <p className="mt-4 text-base sm:text-lg" style={{ color: '#86868b' }}>
          Upload one photo. Get a 720p video of that person delivering your script — lip-synced, with footage, captions and music. Done in about a minute.
        </p>

        <div className="mt-8 flex items-center justify-center">
          <div className="rounded-2xl p-6" style={{ background: 'rgba(41,151,255,0.07)', border: '1.5px solid rgba(41,151,255,0.35)' }}>
            <AvatarDemoLoop size={84} />
            <div className="mt-3 text-xs" style={{ color: '#2997ff' }}>photo → speaking, lip-synced</div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <a href="/generate?avatar=1&utm_source=avatar_landing" className="rounded-xl px-8 py-4 text-base font-extrabold" style={{ background: 'linear-gradient(135deg,#2997ff,#14b8a6)', color: '#04130d', textDecoration: 'none' }}>
            Make my AI Avatar video →
          </a>
          <div className="text-xs" style={{ color: '#2997ff', fontWeight: 700 }}>🚀 Founding price live — from $11.90/video</div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-5 py-10">
        <h2 className="text-center text-2xl font-black mb-6" style={{ color: '#a7f3d0' }}>How it works</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { n: '1', icon: '📸', t: 'Upload a photo', d: 'Yours or anyone’s, with permission.' },
            { n: '2', icon: '✍️', t: 'Type your script', d: 'AI writes, voices and times it.' },
            { n: '3', icon: '🎭', t: 'Get a talking video', d: '720p, lip-synced, ready to post.' },
          ].map((s) => (
            <div key={s.n} className="rounded-xl p-5 text-center" style={{ background: 'rgba(41,151,255,0.06)', border: '1px solid rgba(41,151,255,0.25)' }}>
              <div className="text-2xl">{s.icon}</div>
              <div className="mt-2 text-sm font-bold" style={{ color: '#2997ff' }}>{s.t}</div>
              <div className="mt-1 text-xs" style={{ color: '#86868b' }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-3xl px-5 py-10">
        <h2 className="text-center text-2xl font-black" style={{ color: '#a7f3d0' }}>Simple, one-time pricing</h2>
        <p className="text-center text-xs mt-1 mb-6" style={{ color: '#86868b' }}>No subscription. Credits never expire. Studio members get 15% off.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PACKS.map((p) => (
            <a
              key={p.id}
              href={`/api/stripe/checkout?pack=${p.id}`}
              className="relative rounded-xl p-5 block"
              style={{
                background: p.tag === 'Popular' ? 'rgba(41,151,255,0.12)' : 'rgba(255,255,255,0.03)',
                border: p.tag === 'Popular' ? '1.5px solid rgba(41,151,255,0.65)' : '1.5px solid rgba(255,255,255,0.1)',
                textDecoration: 'none',
              }}
            >
              {p.tag && (
                <span className="absolute -top-2.5 left-4 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: '#2997ff', color: '#04130d' }}>{p.tag}</span>
              )}
              <div className="text-sm font-bold" style={{ color: '#e2e8f0' }}>{p.videos} avatar video{p.videos > 1 ? 's' : ''}</div>
              <div className="mt-1 text-3xl font-black" style={{ color: '#2997ff' }}>${p.usd}</div>
              <div className="mt-1 text-[11px]" style={{ color: '#86868b' }}>${p.per} / video</div>
              <div className="mt-4 rounded-lg py-2 text-center text-sm font-bold" style={{ background: 'linear-gradient(135deg,#2997ff,#14b8a6)', color: '#04130d' }}>Get started →</div>
            </a>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-10">
        <h2 className="text-center text-2xl font-black mb-6" style={{ color: '#a7f3d0' }}>FAQ</h2>
        <div className="flex flex-col gap-2">
          {FAQ.map((f, i) => (
            <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between px-4 py-3 text-left" style={{ background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>
                <span className="text-sm font-bold" style={{ color: '#e2e8f0' }}>{f.q}</span>
                <span style={{ color: '#2997ff' }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && <div className="px-4 py-3 text-sm" style={{ color: '#86868b' }}>{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-5 pb-20 pt-6 text-center">
        <a href="/generate?avatar=1&utm_source=avatar_landing_footer" className="rounded-xl px-8 py-4 text-base font-extrabold inline-block" style={{ background: 'linear-gradient(135deg,#2997ff,#14b8a6)', color: '#04130d', textDecoration: 'none' }}>
          Make my AI Avatar video →
        </a>
        <div className="mt-6 text-xs" style={{ color: '#64748b' }}>Kineo · usekineo.com</div>
      </section>
    </main>
  )
}
