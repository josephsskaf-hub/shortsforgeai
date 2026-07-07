'use client'

// AI Avatar sales landing (/ai-avatar) — a focused page built to SELL the
// premium add-on: hero + live demo + how-it-works + pricing (current packs)
// + launch urgency + FAQ + CTA. Self-contained and additive (no edits to the
// generator/checkout). Shareable link for email, DMs and social. Emerald
// avatar palette to match the in-app components.
import { useState } from 'react'
import AvatarDemoLoop from '@/components/AvatarDemoLoop'

// KINEO-AVATAR-PACKS-RETIRED-2026-07-06 — the one-time avatar-pack pricing grid
// (avatar1/avatar3/avatar10 → ?pack=avatar* checkout) was removed. Those packs
// sold the now-unspendable avatar_credits balance. AI Avatar videos now cost 120
// universal video_credits from any plan, so the pricing section is replaced by a
// CTA into the generator (/generate?avatar=1). PACKS array removed.

const FAQ = [
  { q: 'How real does it look?', a: '720p lip-synced video — the person’s mouth matches your script word for word, with b-roll, captions and music around it.' },
  { q: 'Whose photo can I use?', a: 'Yours, or anyone’s with their permission. One sharp, front-facing photo works best. You confirm you have the right to use it on upload.' },
  { q: 'How long does it take?', a: 'About a minute of your time, a few minutes of rendering. No camera, no mic, no editing.' },
  { q: 'How much does it cost?', a: 'An AI Avatar video uses 120 credits from your plan — the same universal credits that power every Kineo video. No separate add-on to buy.' },
  { q: 'What if a render fails?', a: 'You’re never charged for a failed render. Your credits stay in your balance.' },
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
          {/* KINEO-AVATAR-PACKS-RETIRED-2026-07-06 — was "from $11.90/video" (a
              retired avatar pack). Avatar videos now use universal plan credits. */}
          <div className="text-xs" style={{ color: '#2997ff', fontWeight: 700 }}>🚀 Now built into every plan — powered by your universal credits</div>
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

      {/* Pricing — KINEO-AVATAR-PACKS-RETIRED-2026-07-06 — the one-time avatar-pack
          grid (?pack=avatar*) was removed. AI Avatar videos now run on the same
          universal credits as every Kineo video (120 credits per avatar video),
          so this section drives to the generator / plans instead of a pack sale. */}
      <section className="mx-auto max-w-3xl px-5 py-10">
        <h2 className="text-center text-2xl font-black" style={{ color: '#a7f3d0' }}>Included with your plan</h2>
        <p className="text-center text-xs mt-1 mb-6" style={{ color: '#86868b' }}>No separate add-on. An AI Avatar video uses 120 universal credits — the same credits that power every Kineo video.</p>
        <div className="flex justify-center">
          <a
            href="/generate?avatar=1&utm_source=avatar_landing_pricing"
            className="rounded-xl px-8 py-4 text-base font-extrabold inline-block"
            style={{ background: 'linear-gradient(135deg,#2997ff,#14b8a6)', color: '#04130d', textDecoration: 'none' }}
          >
            Make my AI Avatar video →
          </a>
        </div>
        <p className="text-center text-xs mt-4" style={{ color: '#64748b' }}>
          Need more credits? <a href="/pricing" style={{ color: '#2997ff', textDecoration: 'none', fontWeight: 700 }}>See plans →</a>
        </p>
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
