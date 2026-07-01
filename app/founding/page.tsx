// Founding Member offer (12/06) — dedicated conversion page for cold outreach.
// Every gift-video DM links here. It does ONE job: turn a curious visitor into
// a founding subscriber. 50% off forever via the FOUNDER50 promo (auto-applied
// at checkout through the existing ?promo= flow), hard scarcity (10 seats), and
// two REAL Shorts the engine just produced as proof. Pure client component so
// the autoplay <video> proof loops without any server work.
'use client'

import { useState } from 'react'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'

// Two real, frame-validated Shorts produced by the Fast engine (12/06).
// These ARE the product output — the strongest possible social proof.
// Click-to-play (not autoplay): loading two full MP4s eagerly on a marketing
// page is heavy and unreliable (black boxes on slow connections = looks
// broken = kills conversion). Each card shows an inviting poster until the
// visitor taps play, then the video streams on demand — exactly like /history.
const PROOF_VIDEOS = [
  {
    label: 'Billionaire habits',
    gradient: 'linear-gradient(155deg,#10231b 0%,#0c1a2e 55%,#1a1207 100%)',
    src: 'https://cqqukkvjjrguayiyjvhh.supabase.co/storage/v1/object/public/renders/e92d81bf-0068-46c3-8de7-1f67e2006756/2b312738-90c7-4572-b091-c74c9dfeb90a.mp4',
  },
  {
    label: 'Dark history',
    gradient: 'linear-gradient(155deg,#1a1322 0%,#0c1626 60%,#06131a 100%)',
    src: 'https://cqqukkvjjrguayiyjvhh.supabase.co/storage/v1/object/public/renders/e92d81bf-0068-46c3-8de7-1f67e2006756/a6e0cf39-592d-41bf-b652-04509f22f0bc.mp4',
  },
]

// One proof card: poster → click → streaming video (lazy, one at a time).
function ProofCard({ label, gradient, src }: { label: string; gradient: string; src: string }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="neon-card overflow-hidden" style={{ borderRadius: 16, padding: 8 }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
        {playing ? (
          <video
            src={src}
            autoPlay
            controls
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            aria-label={`Play ${label} Short`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: gradient, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span
              style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(41,151,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 30px rgba(41,151,255,.4)' }}
            >
              <span style={{ borderLeft: '17px solid #06231a', borderTop: '11px solid transparent', borderBottom: '11px solid transparent', marginLeft: 4 }} />
            </span>
            <span style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.85)', fontWeight: 600 }}>
              ▶ Watch a real Short
            </span>
          </button>
        )}
      </div>
      <p className="text-xs mt-2 px-1" style={{ color: 'rgba(255,255,255,.6)' }}>{label} · 45s · 9:16</p>
    </div>
  )
}

// 3 plans. Half-price shown next to the regular price. The link carries the
// promo so the discount applies with zero typing. Creator is the recommended
// middle anchor.
const PLANS = [
  {
    tier: 'starter',
    name: 'Starter',
    regular: '$11.90',
    founder: '$5.95',
    blurb: '15 Shorts / month',
    bullets: ['Smart stock footage', 'AI voiceover + captions', 'Watermark-free MP4'],
    highlight: false,
  },
  {
    tier: 'basic',
    name: 'Creator',
    regular: '$24.90',
    founder: '$12.45',
    blurb: '50 Shorts / month',
    bullets: ['Everything in Starter', 'AI-generated visuals', 'Priority rendering'],
    highlight: true,
  },
  {
    tier: 'pro',
    name: 'Studio',
    regular: '$37.90',
    founder: '$18.95',
    blurb: 'Built for daily posting',
    bullets: ['Cinematic AI engine', 'AI Avatar credits', 'Everything unlocked'],
    highlight: false,
  },
]

export default function FoundingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  function go(tier: string) {
    setLoading(tier)
    // Server-side redirect (iOS Safari safe). Promo auto-applies via ?promo=.
    window.location.href = `/api/stripe/checkout?tier=${tier}&promo=FOUNDER50`
  }

  return (
    <main
      style={{ background: 'var(--bg, #000)', color: 'var(--text, #fff)', minHeight: '100vh' }}
      className="relative overflow-hidden"
    >
      {/* Ambient glow */}
      <div
        className="fixed rounded-full pointer-events-none"
        style={{ width: 620, height: 620, background: '#2997ff', top: -240, right: -160, opacity: 0.08, filter: 'blur(140px)', zIndex: 0 }}
      />
      <div
        className="fixed rounded-full pointer-events-none"
        style={{ width: 520, height: 520, background: '#2997ff', bottom: -200, left: -120, opacity: 0.05, filter: 'blur(130px)', zIndex: 0 }}
      />

      <div className="relative z-10 mx-auto px-5" style={{ maxWidth: 1080 }}>
        {/* Brand */}
        <header className="flex items-center gap-2 pt-7 pb-2">
          <span className="font-display text-lg font-extrabold tracking-tight">
            Kineo
          </span>
        </header>

        {/* Scarcity ribbon */}
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 mt-6"
          style={{ border: '1px solid rgba(41,151,255,.45)', background: 'rgba(41,151,255,.10)' }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2997ff', display: 'inline-block' }} />
          <span className="text-xs font-semibold" style={{ color: '#2997ff', letterSpacing: '.04em' }}>
            FOUNDING OFFER · ONLY 10 SEATS
          </span>
        </div>

        {/* Hero */}
        <section className="pt-5 pb-2" style={{ maxWidth: 760 }}>
          <h1 className="font-display font-extrabold tracking-tight" style={{ fontSize: 'clamp(2.1rem, 5.5vw, 3.6rem)', lineHeight: 1.04 }}>
            Become a founding member.<br />
            <span className="grad-text" style={{ color: '#2997ff' }}>50% off — locked forever.</span>
          </h1>
          <p className="mt-5 text-base md:text-lg" style={{ color: 'rgba(255,255,255,.72)', maxWidth: 620 }}>
            Type a topic. The AI writes the script, picks the footage, voices it and
            captions it — a ready-to-post YouTube Short in about a minute. The first
            10 founders lock <strong style={{ color: '#fff' }}>half price for life</strong>.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={() => go('basic')} className="btn-neon" style={ctaStyle} disabled={loading !== null}>
              {loading === 'basic' ? 'Opening checkout…' : 'Claim my founding seat — $12.45/mo'}
            </button>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,.5)' }}>
              7-day money-back · cancel anytime
            </span>
          </div>
        </section>

        {/* Proof: real Shorts */}
        <section className="pt-10">
          <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,.5)', letterSpacing: '.08em' }}>
            MADE BY THE ENGINE — NOT MOCKUPS
          </p>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', maxWidth: 720 }}>
            {PROOF_VIDEOS.map((v) => (
              <ProofCard key={v.label} label={v.label} gradient={v.gradient} src={v.src} />
            ))}
          </div>
        </section>

        {/* Plans */}
        <section className="pt-12">
          <h2 className="font-display text-2xl font-bold mb-1">Pick your seat</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,.55)' }}>
            Founder pricing is applied automatically at checkout. No code to type.
          </p>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {PLANS.map((p) => (
              <div
                key={p.tier}
                className="neon-card flex flex-col"
                style={{
                  borderRadius: 16,
                  padding: 20,
                  border: p.highlight ? '1.5px solid rgba(41,151,255,.6)' : '1px solid rgba(255,255,255,.08)',
                  boxShadow: p.highlight ? '0 0 0 1px rgba(41,151,255,.25), 0 20px 60px rgba(0,0,0,.45)' : undefined,
                }}
              >
                {p.highlight && (
                  <span className="text-[10px] font-bold mb-2 inline-block" style={{ color: '#000', background: '#2997ff', borderRadius: 6, padding: '2px 8px', width: 'fit-content', letterSpacing: '.05em' }}>
                    MOST POPULAR
                  </span>
                )}
                <h3 className="font-display text-lg font-bold">{p.name}</h3>
                <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,.55)' }}>{p.blurb}</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl font-extrabold" style={{ color: '#2997ff' }}>{p.founder}</span>
                  <span className="text-sm line-through" style={{ color: 'rgba(255,255,255,.4)' }}>{p.regular}</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,.5)' }}>/mo</span>
                </div>
                <ul className="mt-4 mb-5 space-y-2 flex-1">
                  {p.bullets.map((b) => (
                    <li key={b} className="text-sm flex items-start gap-2" style={{ color: 'rgba(255,255,255,.78)' }}>
                      <span style={{ color: '#2997ff' }}>✓</span> {b}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => go(p.tier)}
                  disabled={loading !== null}
                  className={p.highlight ? 'btn-neon' : ''}
                  style={p.highlight ? ctaStyle : ctaSecondaryStyle}
                >
                  {loading === p.tier ? 'Opening…' : `Lock ${p.founder}/mo`}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Trust / why now */}
        <section className="pt-12 pb-4" style={{ maxWidth: 720 }}>
          <h2 className="font-display text-xl font-bold mb-4">Why founders get the best deal</h2>
          <div className="space-y-3 text-sm" style={{ color: 'rgba(255,255,255,.72)' }}>
            <p>
              <strong style={{ color: '#fff' }}>The price never goes up for you.</strong> Lock 50%
              today and keep it for as long as you stay — even when public pricing rises.
            </p>
            <p>
              <strong style={{ color: '#fff' }}>You shape the product.</strong> Founding members get
              a direct line to request features. The roadmap follows real creators.
            </p>
            <p>
              <strong style={{ color: '#fff' }}>Zero risk.</strong> 7-day money-back guarantee. If it
              doesn&apos;t save you hours of editing, you don&apos;t pay.
            </p>
          </div>
        </section>

        <footer className="py-10 text-xs" style={{ color: 'rgba(255,255,255,.4)' }}>
          Kineo · shortsforgeai.com · Questions? support@shortsforgeai.com
        </footer>
      </div>
      <StickyFreeShortCTA />
    </main>
  )
}

const ctaStyle: React.CSSProperties = {
  background: '#2997ff',
  color: '#fff',
  fontWeight: 700,
  fontSize: '0.95rem',
  padding: '12px 22px',
  borderRadius: 12,
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'normal',
  textAlign: 'center',
}

const ctaSecondaryStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,.05)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  padding: '11px 18px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,.14)',
  cursor: 'pointer',
}
