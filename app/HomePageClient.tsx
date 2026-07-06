'use client'

// Push #080 — Top auth buttons polish.
// - Auth state stays reactive via supabase.auth.onAuthStateChange + the
//   initial getSession() check, so the header updates immediately on
//   login/logout without a full page reload.
// - Right side (desktop + mobile): guest = Sign In (ghost) + Sign Up (cyan
//   filled), signed-in = Dashboard (ghost, → /generate) + Sign Out (ghost).
//   Sign Out hits supabase.auth.signOut() then router.push('/').
// - Buttons render only after the auth check completes so we don't flash
//   the wrong state during hydration.

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import AvatarDemoLoop from '@/components/AvatarDemoLoop'
import { createClient } from '@/lib/supabase/client'
import { PLANS, PLAN_LIST } from '@/lib/pricing'
import { HOME_CHIPS, randomTopic } from '@/lib/curatedTopics'
import { captureUtmsOnce } from '@/lib/analytics'
import { captureRefOnce } from '@/lib/referral'
import { trackCheckoutClick } from '@/lib/trackClick'

const THUMBNAIL_ROUTE = '/thumbnail-generator'
// Push #250 — exit-intent survey flags. Both stored in localStorage so they
// persist across sessions. EXIT_SHOWN_KEY gates the show (30-day cooldown);
// EXIT_RESPONDED_KEY is set when the user actually submits — that flag
// suppresses the survey permanently for users who already answered.
// #456 — Measure 1 (leads): lead-magnet ideas revealed after email capture.
// Our proven verticals: extreme places + mystery + money.
const VIRAL_IDEAS = [
  'The island so dangerous it is illegal to visit (Snake Island)',
  'The deepest hole humans ever dug — and why they sealed it',
  'The colony that vanished overnight, leaving one word (Roanoke)',
  'How tiny Monaco became the richest place on Earth',
  'The Roman city frozen in time by a volcano (Pompeii)',
  'The radio signal from deep space that repeats every 16 days',
  'The city built in the desert with no rivers (Dubai)',
  'The 5 richest people and their strangest daily habits',
  'The abandoned Soviet city you can still walk through (Chernobyl)',
  'The mountain so tall planes fly around it, not over it',
]

const EXIT_SHOWN_KEY = 'exitShown_v2_ts'  // stores timestamp of last show
const EXIT_RESPONDED_KEY = 'exitResponded'  // set permanently on submit
const EXIT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const EXIT_REASONS = [
  'Too expensive for me',
  "I'm not sure it works",
  "I'll come back later",
] as const

interface ShowcaseCard {
  category: string
  title: string
  prompt: string
  accent: string
  videoUrl: string
  captions: string[]
  genTime: number
}

// Push #132 — SHOWCASE no longer hard-codes any CDN URLs. Video URLs are
// fetched server-side from Pexels via /api/showcase-clips (1h ISR cache)
// so the page always has working video previews. The `videoUrl` field
// starts as '' and is hydrated on mount; the gradient poster is the
// natural placeholder while the fetch is in flight.
const SHOWCASE_BASE: Omit<ShowcaseCard, 'videoUrl'>[] = [
  {
    category: 'Space Mystery',
    title: 'What NASA hides about the Moon',
    prompt: 'Cinematic space mystery short about unexplained Moon anomalies that NASA never explained',
    accent: '#22D3EE',
    captions: ['NASA lost footage from the Moon...', 'They never showed you THIS', 'What was really up there?'],
    genTime: 54,
  },
  {
    category: 'History Facts',
    title: 'The Roman invention we still use',
    prompt: 'Fast-paced history facts short about a Roman invention that still powers daily life today',
    accent: '#F59E0B',
    captions: ['Romans invented something you use daily', "Most history books skip this part", 'The invention that changed everything'],
    genTime: 61,
  },
  {
    category: 'Hidden Places',
    title: 'Cities erased from every map',
    prompt: 'Dark cinematic short about real hidden cities that governments removed from world maps',
    accent: '#A78BFA',
    captions: ["These cities officially don't exist", 'Governments wiped them from every map', 'But people still live there...'],
    genTime: 48,
  },
  {
    category: 'Cold Case',
    title: 'The case that broke the FBI',
    prompt: 'Suspenseful cold case short about an unsolved FBI investigation with chilling details',
    accent: '#F87171',
    captions: ['This case made 200 FBI agents quit', 'No fingerprints. No witnesses.', 'It was never solved.'],
    genTime: 57,
  },
  {
    category: 'Weird Facts',
    title: 'Facts your brain refuses to believe',
    prompt: 'Punchy weird facts short with 5 facts that sound fake but are 100% true',
    accent: '#A78BFA',
    captions: ['Your brain will say this is fake', "But it's 100% verified", 'Ready to feel small?'],
    genTime: 44,
  },
  {
    category: 'Money Psychology',
    title: 'Why the rich think differently',
    prompt: 'Money psychology short about the mental habits that separate the wealthy from everyone else',
    accent: '#A78BFA',
    captions: ['Billionaires think about money differently', 'This one habit changes everything', 'Most people will never learn this'],
    genTime: 59,
  },
]
// IDs must match SHOWCASE_QUERIES in /api/showcase-clips/route.ts
const SHOWCASE_IDS = ['space', 'history', 'hidden', 'crime', 'facts', 'money']

// ── NEON redesign (12/06) — HeroDemoPhone ────────────────────────────────────
// CSS-only animated phone showing a Short BEING GENERATED on loop: footage
// scenes crossfade, captions cycle, a scanline sweeps, the voiceover EQ pulses
// and the progress bar fills to "✓ Ready to post". Zero assets, zero JS timers
// — pure keyframes, so it costs nothing and never breaks.
function HeroDemoPhone({ clips = [] }: { clips?: (string | undefined)[] }) {
  // Real Pexels footage (from the showcase fetch) crossfades inside the
  // phone when available; the gradient scenes are the zero-network fallback
  // and the initial paint while the clip URLs hydrate.
  const realClips = clips.filter((c): c is string => !!c).slice(0, 3)
  const useReal = realClips.length >= 2
  return (
    <div className="hp-wrap animate-float" aria-hidden>
      <div className="hp-frame">
        <div className="hp-notch" />
        <div className="hp-screen">
          {/* crossfading "footage" scenes — real video when hydrated */}
          {useReal ? (
            realClips.map((src, i) => (
              <video
                key={src}
                className={`hp-clip hp-vid`}
                style={{ animationDelay: `${i * 3}s` }}
                src={src}
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
              />
            ))
          ) : (
            <>
              <div className="hp-clip hp-clip-a" />
              <div className="hp-clip hp-clip-b" />
              <div className="hp-clip hp-clip-c" />
            </>
          )}
          {/* render scanline */}
          <div className="hp-scan" />
          {/* status pill */}
          <div className="hp-status">
            <span className="hp-dot" /> ShortsForgeAI · generating
          </div>
          {/* cycling captions */}
          <div className="hp-captions">
            <span className="hp-cap" style={{ animationDelay: '0s' }}>NASA lost footage from the Moon…</span>
            <span className="hp-cap" style={{ animationDelay: '3s' }}>They never showed you THIS 👀</span>
            <span className="hp-cap" style={{ animationDelay: '6s' }}>What was really up there?</span>
          </div>
          {/* voiceover EQ + progress */}
          <div className="hp-footer">
            <div className="hp-eq">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                <i key={i} style={{ animationDelay: `${(i % 5) * 0.13}s` }} />
              ))}
            </div>
            <div className="hp-track"><div className="hp-fill" /></div>
            <div className="hp-meta">
              <span>0:52 · 9:16</span>
              <span className="hp-ready">✓ Ready to post</span>
            </div>
          </div>
        </div>
      </div>
      {/* floating proof badges */}
      <div className="hp-badge hp-badge-views">▶ 1.2M views</div>
      <div className="hp-badge hp-badge-speed">⚡ rendered in 60s</div>
      <style jsx>{`
        .hp-wrap { position: relative; width: 280px; }
        .hp-frame {
          position: relative;
          width: 280px; height: 580px;
          border-radius: 40px;
          background: linear-gradient(160deg, #1A1A1D, #0F0F10);
          border: 1px solid rgba(167,139,250,0.35);
          box-shadow:
            0 0 0 6px rgba(8,5,18,0.9),
            0 0 60px rgba(139,92,246,0.35),
            0 30px 80px rgba(0,0,0,0.6);
          padding: 10px;
        }
        .hp-notch {
          position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
          width: 86px; height: 18px; border-radius: 10px;
          background: #0A0A0B; z-index: 5;
          border: 1px solid rgba(167,139,250,0.18);
        }
        .hp-screen {
          position: relative; width: 100%; height: 100%;
          border-radius: 32px; overflow: hidden; background: #0D0D0F;
        }
        .hp-clip { position: absolute; inset: 0; opacity: 0; animation: hpClip 9s infinite; }
        .hp-vid { width: 100%; height: 100%; object-fit: cover; }
        .hp-clip-a {
          background:
            radial-gradient(120% 80% at 20% 15%, rgba(139,92,246,0.7), transparent 55%),
            radial-gradient(100% 70% at 85% 80%, rgba(34,211,238,0.5), transparent 60%),
            linear-gradient(180deg, #17171A, #0A0A0C);
          animation-delay: 0s;
        }
        .hp-clip-b {
          background:
            radial-gradient(110% 75% at 75% 20%, rgba(167,139,250,0.55), transparent 55%),
            radial-gradient(90% 70% at 20% 85%, rgba(139,92,246,0.55), transparent 60%),
            linear-gradient(180deg, #19191C, #0E0E10);
          animation-delay: 3s;
        }
        .hp-clip-c {
          background:
            radial-gradient(120% 80% at 50% 10%, rgba(34,211,238,0.55), transparent 55%),
            radial-gradient(90% 60% at 80% 90%, rgba(139,92,246,0.4), transparent 60%),
            linear-gradient(180deg, #1B1B1E, #09090B);
          animation-delay: 6s;
        }
        @keyframes hpClip {
          0% { opacity: 0; transform: scale(1.08); }
          5% { opacity: 1; }
          33% { opacity: 1; transform: scale(1); }
          38% { opacity: 0; }
          100% { opacity: 0; }
        }
        .hp-scan {
          position: absolute; left: 0; right: 0; height: 70px; top: -12%;
          background: linear-gradient(180deg, transparent, rgba(34,211,238,0.16), rgba(34,211,238,0.4), rgba(34,211,238,0.16), transparent);
          animation: scanline 4.5s linear infinite;
          z-index: 2;
        }
        .hp-status {
          position: absolute; top: 46px; left: 50%; transform: translateX(-50%);
          display: flex; align-items: center; gap: 6px;
          padding: 5px 11px; border-radius: 999px;
          background: rgba(4,2,9,0.75); backdrop-filter: blur(6px);
          border: 1px solid rgba(167,139,250,0.35);
          font-size: 10px; font-weight: 800; color: #d8cff5;
          white-space: nowrap; z-index: 4;
        }
        .hp-dot {
          width: 6px; height: 6px; border-radius: 999px; background: #22D3EE;
          box-shadow: 0 0 10px rgba(34,211,238,0.9);
          animation: pulse 1.4s infinite;
        }
        .hp-captions {
          position: absolute; left: 16px; right: 16px; bottom: 118px;
          height: 52px; z-index: 3;
        }
        .hp-cap {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          text-align: center;
          font-family: var(--font-display);
          font-size: 16px; font-weight: 700; line-height: 1.25; color: #fff;
          text-shadow: 0 2px 14px rgba(0,0,0,0.85);
          opacity: 0;
          animation: hpCap 9s infinite;
        }
        @keyframes hpCap {
          0% { opacity: 0; transform: translateY(8px); }
          4% { opacity: 1; transform: translateY(0); }
          30% { opacity: 1; }
          36% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 0; }
        }
        .hp-footer {
          position: absolute; left: 14px; right: 14px; bottom: 16px; z-index: 4;
          background: rgba(4,2,9,0.72); backdrop-filter: blur(8px);
          border: 1px solid rgba(167,139,250,0.22);
          border-radius: 14px; padding: 10px 12px;
        }
        .hp-eq { display: flex; align-items: flex-end; gap: 3px; height: 18px; margin-bottom: 8px; }
        .hp-eq i {
          flex: 1; height: 100%; border-radius: 2px;
          background: linear-gradient(180deg, #22D3EE, #8B5CF6);
          transform-origin: bottom; transform: scaleY(0.3);
          animation: eqBar 0.9s ease-in-out infinite;
        }
        .hp-track { height: 5px; border-radius: 999px; background: rgba(167,139,250,0.16); overflow: hidden; }
        .hp-fill {
          height: 100%; border-radius: 999px;
          background: linear-gradient(90deg, #8B5CF6, #22D3EE);
          box-shadow: 0 0 12px rgba(34,211,238,0.6);
          animation: demoProgress 9s ease-in-out infinite;
        }
        .hp-meta { display: flex; justify-content: space-between; margin-top: 7px; font-size: 10px; font-weight: 700; color: #9d96b8; }
        .hp-ready { color: #A78BFA; }
        .hp-badge {
          position: absolute; z-index: 6;
          padding: 8px 13px; border-radius: 12px;
          font-size: 12px; font-weight: 900; color: #fff;
          background: rgba(10,6,24,0.85); backdrop-filter: blur(8px);
          border: 1px solid rgba(167,139,250,0.35);
          box-shadow: 0 8px 30px rgba(0,0,0,0.5), 0 0 22px rgba(139,92,246,0.25);
          white-space: nowrap;
        }
        .hp-badge-views { top: 96px; right: -54px; color: #22D3EE; animation: floatY 5s ease-in-out infinite; animation-delay: -2s; }
        .hp-badge-speed { bottom: 150px; left: -58px; color: #A78BFA; animation: floatY 7s ease-in-out infinite; animation-delay: -4s; }
        @media (max-width: 1100px) {
          .hp-badge-views { right: -16px; }
          .hp-badge-speed { left: -16px; }
        }
      `}</style>
    </div>
  )
}

function trackHomepageEvent(name: string): void {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: name,
        name,
        path: typeof window !== 'undefined' ? window.location?.pathname : undefined,
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore
  }
}

interface HomePageClientProps {
  initialUser: { id: string } | null
  initialEmail: string
  initialIsPro: boolean
}

// Push #490 — toolkit row icons for the new dashboard hero. Inline SVG so we
// stay dependency-free (no icon lib). Stroke = passed color; "dots" is filled.
function ToolIcon({ name, color }: { name: string; color: string }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'inline-block' }}>
      {name === 'wand' && (<g {...p}><path d="M3 21l9-9" /><path d="M15 4V2" /><path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8 19 13" /><path d="M17.8 6.2 19 5" /></g>)}
      {name === 'image' && (<g {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></g>)}
      {name === 'play' && (<g {...p}><polygon points="6 3 20 12 6 21 6 3" /></g>)}
      {name === 'user' && (<g {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></g>)}
      {name === 'dots' && (<g fill={color}><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></g>)}
    </svg>
  )
}

export default function HomePageClient({ initialUser }: HomePageClientProps) {
  const router = useRouter()

  const [user, setUser] = useState<{ id: string } | null>(initialUser)
  const [authChecked, setAuthChecked] = useState(!!initialUser)
  const [prompt, setPromptText] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  // Push #077 — pricing card selected state. Pro is selected by default.
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'basic' | 'pro' | null>('pro')
  // Push #081 — credits pill in header. null while loading; never shown
  // when logged out. We only fetch once auth is confirmed so we don't
  // hammer the credits route during the unauth flash.
  const [credits, setCredits] = useState<number | null>(null)
  const [checkoutTier, setCheckoutTier] = useState<'starter' | 'basic' | 'pro' | null>(null)
  const [pricingBilling, setPricingBilling] = useState<'monthly' | 'annual'>('monthly') // #382 — home pricing monthly/annual toggle
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  // Push #171 — show a friendly "already subscribed" banner instead of a
  // red error when the API blocks a duplicate purchase attempt.
  const [alreadySubscribed, setAlreadySubscribed] = useState(false)
  // Push #232 — exit-intent survey state. One-shot per session, desktop
  // only, after a 5s dwell. `exitReason` holds the selected radio option,
  // `exitComment` the optional free-text, `exitSubmitting` guards the POST.
  const [showExitIntent, setShowExitIntent] = useState(false)
  const [exitReason, setExitReason] = useState<string | null>(null)
  const [exitComment, setExitComment] = useState('')
  const [exitSubmitting, setExitSubmitting] = useState(false)
  // #456 — Measure 1 (leads): exit-intent now captures an email for a lead
  // magnet (10 viral ideas) instead of just a survey. Turns the ~90% who bounce
  // without signing up into nurtured leads saved in the `leads` table.
  const [leadEmail, setLeadEmail] = useState('')
  const [leadDone, setLeadDone] = useState(false)
  async function submitLead() {
    const email = leadEmail.trim()
    if (!email || !email.includes('@') || exitSubmitting) return
    setExitSubmitting(true)
    try {
      trackHomepageEvent('lead_captured')
      // #457 — TikTok Pixel: Lead event for retargeting captured leads
      try {
        const ttq = (window as unknown as { ttq?: { track: Function } }).ttq
        if (ttq && typeof ttq.track === 'function') ttq.track('Lead', { content_name: '10_viral_ideas' })
      } catch { /* non-blocking */ }
      await fetch('/api/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'exit_intent_landing', magnet: '10_viral_ideas' }),
      })
      try { localStorage.setItem(EXIT_RESPONDED_KEY, '1') } catch {}
    } catch {
      // never block the reward on a failed save
    }
    setExitSubmitting(false)
    setLeadDone(true)
  }
  // Push #104 — live "X Shorts created today" counter for the social
  // proof bar. Falls back to the API's baseline if the fetch fails.
  const [shortsToday, setShortsToday] = useState<number>(26)
  // Push #116 — cumulative hero counter ("9,847 Shorts created — and
  // counting"). Bumps +1 every 30s in a setInterval so the page reads
  // as alive while the visitor sits on it.
  const [shortsTotal, setShortsTotal] = useState<number>(303)
  // Push #231 — rolling 7-day count for the hero "X videos created this
  // week" line. Seeded from the API's WEEK_BASELINE so it never reads 0.
  const [shortsWeek, setShortsWeek] = useState<number>(103)
  // Push #227 — count-up animation. `animatedTotal` is the value actually
  // rendered; it eases toward `shortsTotal` (0 → baseline on first paint,
  // then to the real number once /api/stats resolves). The ref lets the
  // rAF loop read the live displayed value without re-triggering itself.
  const [animatedTotal, setAnimatedTotal] = useState<number>(0)
  const animatedTotalRef = useRef<number>(0)

  // Push #132 — showcase video URLs fetched from /api/showcase-clips so
  // the page never hard-codes a CDN that can go private. Start empty so
  // gradient placeholders show immediately; hydrate on mount.
  const [showcaseVideos, setShowcaseVideos] = useState<Record<string, string>>({})
  // Landing demo (13/06) — live script preview for guests.
  const [demoScript, setDemoScript] = useState<string | null>(null)
  const [demoShown, setDemoShown] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)

  // Typewriter reveal — the script "writes itself" on screen.
  useEffect(() => {
    if (!demoScript) return
    let i = 0
    const id = setInterval(() => {
      i += 3
      setDemoShown(demoScript.slice(0, i))
      if (i >= demoScript.length) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [demoScript])

  useEffect(() => {
    // Push #228 — serve showcase URLs from a per-session cache so an
    // in-session navigation back to the homepage doesn't refetch them.
    try {
      const cached = sessionStorage.getItem('sfa_showcase')
      if (cached) {
        const sv = JSON.parse(cached) as Record<string, string>
        if (sv && typeof sv === 'object' && Object.keys(sv).length > 0) {
          setShowcaseVideos(sv)
          return
        }
      }
    } catch { /* ignore */ }

    void fetch('/api/showcase-clips')
      .then((r) => r.json())
      .then((data: { clips?: Record<string, string | null> }) => {
        const clips = data.clips ?? {}
        const sv: Record<string, string> = {}
        SHOWCASE_IDS.forEach((id, i) => { if (clips[id]) sv[`${i}`] = clips[id] as string })
        setShowcaseVideos(sv)
        try { sessionStorage.setItem('sfa_showcase', JSON.stringify(sv)) } catch { /* ignore */ }
      })
      .catch(() => { /* fall back to gradient placeholders */ })
  }, [])

  useEffect(() => {
    captureUtmsOnce() // #377 — first-touch UTM/gclid capture on landing
    captureRefOnce()  // referral loop — first-touch ?ref= capture on landing
    trackHomepageEvent('homepage_view')
  }, [])

  useEffect(() => {
    let cancelled = false
    // Push #228 — seed the counters from a 5-minute sessionStorage cache
    // and skip the network entirely while it's fresh. The API already sets
    // s-maxage=300, so this just extends that cache to in-session client
    // navigations and avoids a counter fetch on every mount.
    try {
      const cached = sessionStorage.getItem('sfa_stats')
      if (cached) {
        const { count, week, total, ts } = JSON.parse(cached)
        if (typeof count === 'number') setShortsToday(count)
        if (typeof week === 'number') setShortsWeek(week)
        if (typeof total === 'number') setShortsTotal(total)
        if (typeof ts === 'number' && Date.now() - ts < 300_000) return
      }
    } catch { /* ignore */ }

    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        if (typeof d.count === 'number') setShortsToday(d.count)
        if (typeof d.week === 'number') setShortsWeek(d.week)
        if (typeof d.total === 'number') setShortsTotal(d.total)
        try {
          sessionStorage.setItem('sfa_stats', JSON.stringify({ count: d.count, week: d.week, total: d.total, ts: Date.now() }))
        } catch { /* ignore */ }
      })
      .catch(() => {/* keep the baseline fallback */})
    return () => {
      cancelled = true
    }
  }, [])

  // Push #116 — bump the cumulative hero counter every 30s so the page
  // feels alive while a visitor reads. Strictly visual — the real count
  // re-syncs on the next page load via /api/stats.
  useEffect(() => {
    const id = window.setInterval(() => {
      setShortsTotal((n) => n + 1)
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])

  // Push #227 — ease the displayed counter toward the live total. First
  // paint animates 0 → baseline (long, ~1.4s, so it reads as a count-up);
  // later changes (API resolve, +1 ticks) settle quickly. easeOutCubic.
  useEffect(() => {
    const from = animatedTotalRef.current
    const to = shortsTotal
    if (from === to) return
    const duration = from === 0 ? 1400 : 500
    const startTime = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const val = Math.round(from + (to - from) * eased)
      animatedTotalRef.current = val
      setAnimatedTotal(val)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [shortsTotal])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? { id: data.session.user.id } : null)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null)
      setAuthChecked(true)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Push #081 — fetch credits when the user is signed in. Failures are
  // swallowed; the pill simply does not render rather than breaking the
  // header layout. We re-fetch on user-id change so a sign-in/sign-out
  // cycle picks up the new balance.
  useEffect(() => {
    if (!user) {
      setCredits(null)
      return
    }
    let cancelled = false
    fetch('/api/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data && typeof data.credits === 'number') {
          setCredits(data.credits)
        }
      })
      .catch(() => {/* silent */})
    return () => {
      cancelled = true
    }
  }, [user])

  // Push #232 — exit-intent survey. Fires once per session when the cursor
  // leaves the top of the viewport (the canonical "about to close the tab"
  // gesture). Gated to: desktop only (innerWidth > 768), a 5s minimum dwell
  // so we don't ambush a visitor who immediately bounces, and one-shot via
  // the `exitShown` sessionStorage flag. This component only renders on the
  // public homepage, so the "public pages only" rule is satisfied by scope.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.innerWidth <= 768) return
    try {
      // Never show to users who already responded
      if (localStorage.getItem(EXIT_RESPONDED_KEY) === '1') return
      // Respect 30-day cooldown between shows
      const lastShown = Number(localStorage.getItem(EXIT_SHOWN_KEY) ?? '0')
      if (lastShown && Date.now() - lastShown < EXIT_COOLDOWN_MS) return
    } catch {
      // ignore
    }
    const mountedAt = Date.now()
    function handleMouseLeave(e: MouseEvent) {
      if (e.clientY > 0) return
      // 15s minimum dwell before showing (up from 5s)
      if (Date.now() - mountedAt < 15000) return
      try {
        localStorage.setItem(EXIT_SHOWN_KEY, String(Date.now()))
      } catch {
        // ignore
      }
      trackHomepageEvent('exit_survey_shown')
      setShowExitIntent(true)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [])

  // Push #232 — POST the exit survey to /api/exit-feedback (Supabase via
  // service role) then close. keepalive lets the request finish even if the
  // visitor closes the tab on the way out. Failures are swallowed — the
  // modal must always close cleanly.
  async function submitExitFeedback() {
    if (exitSubmitting) return
    setExitSubmitting(true)
    trackHomepageEvent('exit_survey_submit')
    try {
      await fetch('/api/exit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: exitReason, comment: exitComment.trim() }),
        keepalive: true,
      })
    } catch {
      // ignore — never block the close on a network failure
    } finally {
      // Push #250 — mark permanently responded so this user never sees the
      // survey again, even across sessions and devices that share localStorage.
      try { localStorage.setItem(EXIT_RESPONDED_KEY, '1') } catch { /* ignore */ }
      setExitSubmitting(false)
      setShowExitIntent(false)
    }
  }

  // Push #081 — Start Free routing rule. Logged-in users go straight to
  // /generate (with their prompt pre-filled if any). Logged-out users go
  // to /signup with a redirect param so the post-signup flow lands on
  // /generate, not the dashboard. Previously this routed to /login,
  // which was confusing for first-time visitors clicking "Start Free".
  // Push #227 — stash the visitor's idea so it survives the signup hop.
  // The signup page hardcodes router.push('/generate'), dropping the
  // ?redirect= prompt, but GenerateClient reads `pendingVideoPrompt` on
  // mount and pre-fills from it. So logged-out visitors who type an idea
  // here still land on the generator with their idea intact.
  function stashPrompt(text: string) {
    try {
      if (text.trim()) sessionStorage.setItem('pendingVideoPrompt', text.trim())
    } catch {
      // sessionStorage can throw in some sandboxes — safe to ignore.
    }
  }

  function goToGenerate(text?: string) {
    const trimmed = (text ?? prompt).trim()
    setSubmitting(true)
    stashPrompt(trimmed)
    const dest = trimmed
      ? `/generate?prompt=${encodeURIComponent(trimmed)}`
      : '/generate'
    const target = user ? dest : `/signup?redirect=${encodeURIComponent(dest)}`
    router.push(target)
  }

  // Landing demo (13/06) — guests with a typed topic get the magic BEFORE the
  // signup wall: a real structured script appears live under the form (public
  // /api/demo-script, gpt-4o-mini). The render CTA then routes through the
  // normal goToGenerate signup stash. Logged-in users skip straight to
  // /generate as always.
  async function runDemoOrGenerate() {
    const trimmed = prompt.trim()
    if (user || !trimmed) {
      goToGenerate()
      return
    }
    trackHomepageEvent('hero_demo_script_run')
    setDemoError(null)
    setDemoScript(null)
    setDemoShown('')
    setDemoLoading(true)
    try {
      const res = await fetch('/api/demo-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: trimmed }),
      })
      const data = await res.json()
      if (!res.ok || typeof data?.script !== 'string') {
        setDemoError(typeof data?.error === 'string' ? data.error : 'Could not write the demo. Try again.')
        return
      }
      setDemoScript(data.script)
    } catch {
      setDemoError('Could not write the demo. Try again.')
    } finally {
      setDemoLoading(false)
    }
  }

  function goToShowcase(cardPrompt: string) {
    stashPrompt(cardPrompt)
    const dest = `/generate?prompt=${encodeURIComponent(cardPrompt)}`
    const target = user ? dest : `/signup?redirect=${encodeURIComponent(dest)}`
    router.push(target)
  }

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      const supabase = createClient()
      // scope:'local' clears the session from cookies/localStorage immediately
      // without a server round-trip, preventing the "Signing out…" freeze that
      // happens when supabase.auth.signOut() stalls on a slow/failed network.
      // A 3 s timeout race guarantees we always reach the finally block.
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ])
    } catch {
      // ignore
    } finally {
      // Hard redirect so all React state (including signingOut) is cleared
      // and the server renders the page fresh with no auth cookie.
      window.location.href = '/'
    }
  }

  // Push #173 — iOS Safari blocks window.location.href changes inside
  // async/await (user gesture chain severed after first await). Fix: navigate
  // directly to the GET checkout endpoint which does a server-side 302 to
  // Stripe — no fetch, no await, no gesture breakage on any mobile browser.
  function handleStartPlan(tier: 'starter' | 'basic' | 'pro') {
    trackHomepageEvent(tier === 'basic' ? 'basic_checkout_clicked' : 'pro_checkout_clicked')
    if (tier === 'basic' || tier === 'pro') trackCheckoutClick(tier)
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent('/pricing')}`)
      return
    }
    setCheckoutTier(tier)
    const billingParam = pricingBilling === 'annual' ? '&billing=annual' : ''
    window.location.href = `/api/stripe/checkout?tier=${tier}${billingParam}`
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F1F5F9] font-sans">
      {/* Subtle cyber-blue glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-[300px] -right-[200px] h-[800px] w-[800px] rounded-full opacity-[0.07]"
        style={{ background: '#22D3EE', filter: 'blur(140px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-[400px] -left-[200px] h-[700px] w-[700px] rounded-full opacity-[0.05]"
        style={{ background: '#8B5CF6', filter: 'blur(160px)' }}
      />

      {/* ───────── Top Nav ───────── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#121214]/90 backdrop-blur-xl">
        {/* Push #252 — full-width nav bar matching the footer; both use the
            same px-6 sm:px-10 padding so logo/links/buttons are flush. */}
        <div className="flex h-[68px] w-full items-center justify-between px-6 sm:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#121214] border border-violet-500/40 text-lg shadow-[0_0_14px_rgba(34,211,238,.35)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#22D3EE" stroke="#8B5CF6" strokeWidth="0.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-extrabold tracking-tight">
                <span className="text-white">Shorts</span>
                <span className="text-white">Forge</span>
                <span className="text-cyan-400">AI</span>
              </span>
              <span className="text-[10px] font-semibold text-[#94A3B8] mt-0.5">v3.0</span>
            </div>
          </Link>

          {/* Center links — desktop. Push #251: flex-1 + justify-center mirrors
              footer center group so links align symmetrically in both bars. */}
          <div className="hidden flex-1 items-center justify-center gap-9 md:flex">
            <Link href="/generate" className="text-[1rem] font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">AI Video Generator</Link>
            {/* Face-app — AI Avatar entry in the top menu (12/06). Deep-links
                to /generate with the avatar panel auto-open. */}
            <Link href="/avatar" className="flex items-center gap-1.5 text-[1rem] font-medium text-[#A78BFA] hover:text-[#C4B5FD] transition">
              🎭 AI Avatar
              <span className="rounded-full bg-violet-400/15 border border-violet-400/40 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-300">New</span>
            </Link>
            <Link href={THUMBNAIL_ROUTE} className="text-[1rem] font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">Thumbnail</Link>
            <Link href="/viral-now" className="text-[1rem] font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">Viral Now</Link>
            <a href="/pricing" className="text-[1rem] font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">Pricing</a>
          </div>

          {/* Right side — desktop. Push #079: guest = Sign In (ghost) +
              Sign Up (solid blue), signed-in = Dashboard (ghost, → /generate)
              + Sign Out (outline). Buttons are only rendered after the auth
              check completes so we don't flash the wrong state on hydration. */}
          <div className="hidden items-center gap-2 md:flex">
            {!authChecked ? (
              <div aria-hidden className="h-9 w-40" />
            ) : user ? (
              <>
                {/* Push #081 — credits pill. Hidden while loading so
                    we never flash a misleading "0 credits". */}
                {credits !== null && (
                  <span
                    className="text-xs font-bold text-cyan-400 border border-cyan-400/30 rounded-full px-2.5 py-1 bg-cyan-400/[0.04]"
                    title="Video credits remaining"
                  >
                    {credits} credits
                  </span>
                )}
                <Link
                  href="/generate"
                  className="rounded-lg border border-white/20 px-5 py-2.5 text-[1rem] font-medium text-white transition-colors hover:bg-white/5"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded-lg border border-white/20 px-5 py-2.5 text-[1rem] font-medium text-white transition-colors hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
                >
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg border border-white/20 px-5 py-2.5 text-[1rem] font-medium text-white transition-colors hover:bg-white/5"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-[#22D3EE] px-5 py-2.5 text-[1rem] font-bold text-[#0A0A0B] transition-colors hover:bg-cyan-300 shadow-[0_4px_18px_rgba(34,211,238,.35)]"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile right side: persistent CTA + hamburger. Push #079 mirrors
              the desktop auth split — Dashboard (ghost, → /generate) when
              signed in, Sign Up (solid blue) when signed out. Sign In and
              Sign Out live in the dropdown panel below to keep the bar tight. */}
          <div className="flex items-center gap-2 md:hidden">
            {!authChecked ? (
              <div aria-hidden className="h-9 w-20" />
            ) : user ? (
              <>
                {credits !== null && (
                  <span
                    className="text-[10px] font-bold text-cyan-400 border border-cyan-400/30 rounded-full px-2 py-0.5 bg-cyan-400/[0.04]"
                    title="Video credits"
                  >
                    {credits}
                  </span>
                )}
                <Link
                  href="/generate"
                  className="rounded-lg border border-white/20 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/5"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <Link
                href="/signup"
                className="rounded-lg bg-[#22D3EE] px-3 py-2 text-[13px] font-bold text-[#0A0A0B] transition-colors hover:bg-cyan-300 shadow-[0_4px_14px_rgba(34,211,238,.35)]"
              >
                Start Free
              </Link>
            )}
            <button
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-[#94A3B8] hover:text-[#F1F5F9]"
            >
              <span className="block h-[2px] w-4 bg-current relative">
                <span className="absolute -top-[5px] left-0 block h-[2px] w-4 bg-current" />
                <span className="absolute top-[5px] left-0 block h-[2px] w-4 bg-current" />
              </span>
            </button>
          </div>
        </div>

        {/* Mobile menu panel — Push #079: nav items + auth tail. Guests get
            both Sign In (ghost) and Sign Up (solid blue) so the full auth
            choice is visible from one tap. Signed-in users get Sign Out. */}
        {navOpen && (
          <div className="md:hidden border-t border-white/[0.08] bg-[#121214]/95 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              <Link onClick={() => setNavOpen(false)} href="/generate" className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">AI Video Generator</Link>
              <Link onClick={() => setNavOpen(false)} href="/avatar" className="rounded-md px-3 py-2 text-sm font-bold text-[#A78BFA] hover:bg-violet-400/[.06] hover:text-[#C4B5FD]">🎭 AI Avatar <span className="ml-1 rounded-full bg-violet-400/15 border border-violet-400/40 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-300">New</span></Link>
              <Link onClick={() => setNavOpen(false)} href={THUMBNAIL_ROUTE} className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">Thumbnail</Link>
              <Link onClick={() => setNavOpen(false)} href="/viral-now" className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">Viral Now</Link>
              <a onClick={() => setNavOpen(false)} href="/pricing" className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">Pricing</a>

              <div className="my-2 h-px bg-white/[0.06]" />

              {authChecked && user ? (
                <button
                  type="button"
                  onClick={async () => {
                    setNavOpen(false)
                    await handleSignOut()
                  }}
                  disabled={signingOut}
                  className="text-left rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
                >
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              ) : (
                <>
                  <Link
                    onClick={() => setNavOpen(false)}
                    href="/login"
                    className="rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5"
                  >
                    Sign In
                  </Link>
                  <Link
                    onClick={() => setNavOpen(false)}
                    href="/signup"
                    className="rounded-md bg-[#22D3EE] px-3 py-2 text-sm font-bold text-[#0A0A0B] transition-colors hover:bg-cyan-300"
                  >
                    Start Free
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ───────── Hero ─────────
          Push #248 — removed background video (was loading showcase clips
          behind the hero text). Cleaner solid-dark hero without the
          autoplay video. */}
      <div style={{ minHeight: '88vh' }}>
      <section className="tech-grid relative mx-auto max-w-7xl px-4 pt-10 pb-10 sm:px-6 sm:pt-14 sm:pb-16" style={{ zIndex: 2 }}>
        {/* NEON redesign — drifting aurora orbs behind the first fold */}
        <div aria-hidden className="aurora-orb" style={{ width: 440, height: 440, top: -90, left: '-8%', background: 'radial-gradient(circle, rgba(139,92,246,0.5), transparent 70%)' }} />
        <div aria-hidden className="aurora-orb" style={{ width: 400, height: 400, top: 30, right: '-6%', background: 'radial-gradient(circle, rgba(34,211,238,0.34), transparent 70%)', animationDelay: '-8s' }} />

        {/* Push #490 — Studio dashboard hero (variação 2 aprovada): compact
            headline + flagship banner (Cinematic AI) + highlight stack
            (Sora 2 / AI Generated / Viral Now) + "Your toolkit" row.
            Acento violeta (#8B5CF6) com apoio cyan (#22D3EE). The prompt box
            and the SEO/marketing content below are kept intact. */}
        <div className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(139,92,246,0.4)] bg-[rgba(139,92,246,0.12)] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#C4B5FD]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22D3EE] shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
              AI Video Engine v3
            </div>
            {/* ROBO1-CONV-2026-06-29 */}
            {/* ROBO1-CONV-2026-06-28 — hero tightened to the positioning
                (one idea → one finished Short, built deliberately per topic;
                NOT a long-video re-clipper) + one honest FOUNDING50 urgency
                line (first 10 founding members, 50% off locked for life —
                mirrors /founding). No fake countdown, no invented numbers. */}
            <h1 className="font-display text-balance text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl text-[var(--text)]">
              One idea in.{' '}
              <span className="grad-text neon-text">One ready-to-post Short</span>{' '}
              out.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] sm:text-base text-[#9D96B8]">
              Not a long-video re-clipper. Type one topic and ShortsForgeAI builds a finished faceless Short deliberately for that idea — hook, script, AI voice, captions and B-roll, 9:16 · ~60s · English — then you download and post to YouTube, TikTok &amp; Reels.
            </p>
            {/* ROBO-FOUNDING-50 — honest founding urgency (mirrors /founding's
                10 seats, 50% off for life) now links to the dedicated /founding
                conversion page (proof Shorts + auto-applied discount). */}
            <p className="mt-4 text-sm font-bold text-[#A78BFA]">
              🔑 Founding offer — the first <span className="text-cyan-400">10 members</span> lock 50% off for life ·{' '}
              <Link href="/founding" className="text-cyan-400 underline-offset-2 hover:underline">Claim a seat →</Link>
            </p>
          </div>

          {/* Dashboard: flagship banner + highlight stack */}
          <div className="mt-9 grid gap-3 lg:grid-cols-[1.55fr_1fr]">
            {/* Flagship — Cinematic AI */}
            <button
              type="button"
              onClick={() => { trackHomepageEvent('hero_flagship_cta_click'); goToGenerate() }}
              className="group relative flex min-h-[230px] flex-col justify-between overflow-hidden rounded-2xl border border-[rgba(139,92,246,0.35)] p-6 text-left sm:p-7"
              style={{ background: 'radial-gradient(circle at 65% 20%, rgba(139,92,246,0.38), #140d22 55%, #0b0b10 82%)' }}
            >
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#C4B5FD]">★ Start here</span>
              <div className="relative z-10">
                <div className="font-display text-3xl font-bold text-white sm:text-4xl">Generate your first Short</div>
                <div className="mt-1.5 text-sm text-[#CFC6E6]">One idea → a finished 9:16 Short. Free to try — no credit card.</div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-[13px] font-bold text-white transition group-hover:brightness-110">Generate my first Short — free →</span>
                  <span className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-[#E8E8EC]">AI voice + B-roll</span>
                  <span className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-[#E8E8EC]">~60s</span>
                  <span className="rounded-lg border border-[rgba(34,211,238,0.4)] px-3 py-1.5 text-[11px] text-[#22D3EE]">No card</span>
                </div>
              </div>
            </button>

            {/* Highlight stack */}
            <div className="grid grid-rows-3 gap-3">
              <Link href="/generate" onClick={() => trackHomepageEvent('hero_card_sora')} className="relative min-h-[66px] overflow-hidden rounded-2xl border border-white/5 p-4 transition hover:border-white/15" style={{ background: 'radial-gradient(circle at 75% 30%, rgba(34,211,238,0.3), #0c0c12 78%)' }}>
                <span className="absolute right-3 top-3 text-[9px] font-bold tracking-wide text-[#67E8F9]">EXCLUSIVE</span>
                <div className="text-[15px] font-extrabold text-white">Sora 2</div>
                <div className="text-[12px] text-[#9FD9E3]">Top realism · native audio</div>
              </Link>
              <Link href="/generate" onClick={() => trackHomepageEvent('hero_card_aigen')} className="relative min-h-[66px] overflow-hidden rounded-2xl border border-white/5 p-4 transition hover:border-white/15" style={{ background: 'radial-gradient(circle at 75% 30%, rgba(245,158,11,0.28), #0c0c12 78%)' }}>
                <div className="text-[15px] font-extrabold text-white">AI Generated</div>
                <div className="text-[12px] text-[#E8C48A]">Fast · Seedance</div>
              </Link>
              <Link href="/viral-now" onClick={() => trackHomepageEvent('hero_card_viral')} className="relative min-h-[66px] overflow-hidden rounded-2xl border border-white/5 p-4 transition hover:border-white/15" style={{ background: 'radial-gradient(circle at 75% 30%, rgba(251,113,133,0.28), #0c0c12 78%)' }}>
                <span className="absolute right-3 top-3 text-[9px] font-bold tracking-wide text-[#FDA4AF]">TRENDING</span>
                <div className="text-[15px] font-extrabold text-white">Viral Now</div>
                <div className="text-[12px] text-[#F3B6BD]">Today&apos;s hot topics, 1 click</div>
              </Link>
            </div>
          </div>

          {/* Your toolkit */}
          <div className="mb-3 mt-6 flex items-center justify-between">
            <span className="text-[13px] font-bold text-[var(--text)]">Your toolkit</span>
            <Link href="/pricing" className="text-[12px] text-[#9D96B8] hover:text-white">See all →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {([
              { href: '/generate', label: 'AI Generator', color: '#a78bfa', icon: 'wand' },
              { href: THUMBNAIL_ROUTE, label: 'Thumbnails', color: '#fcd34d', icon: 'image' },
              { href: '/animate', label: 'Animate Photo', color: '#a78bfa', icon: 'play' },
              { href: '/avatar', label: 'AI Avatar', color: '#22D3EE', icon: 'user' },
              { href: '/pricing', label: 'Pricing', color: '#9a9aa3', icon: 'dots' },
            ] as const).map((t) => (
              <Link key={t.label} href={t.href} className="rounded-2xl border border-white/5 bg-[#101016] p-4 text-center transition hover:border-white/15">
                <ToolIcon name={t.icon} color={t.color} />
                <div className="mt-2 text-[12px] font-semibold text-[var(--text)]">{t.label}</div>
              </Link>
            ))}
          </div>
          {/* Push #432 — welcome-gift trust line under the dashboard. */}
          {/* ROBO1-CONV-2026-06-28 — free-first reassurance row. */}
          <p className="mt-5 text-center text-[13px] font-semibold text-[#9D96B8]">
            🎁 <span className="text-[#A78BFA] font-bold">Your first Short is free</span> · No credit card · Cancel anytime
          </p>
        </div>{/* end hero grid */}

        {/* Push #227 — InVideo-style prompt box. Type a topic → generate.
            Push #228 — back to a tall textarea (like the pre-#227 card) for
            longer ideas, keeping the new cyan-accent styling and button.
            The idea is stashed via goToGenerate so it survives the signup
            hop for logged-out visitors. */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            trackHomepageEvent('hero_prompt_box_submit')
            void runDemoOrGenerate()
          }}
          className="neon-card mx-auto mt-10 flex w-full max-w-[760px] flex-col gap-4 p-4 transition focus-within:!border-cyan-400/60 sm:p-5"
        >
          <textarea
            value={prompt}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder={'Type any topic — e.g. "The mystery of the Bermuda Triangle" or "How Jeff Bezos starts his day"'}
            maxLength={5000}
            rows={7}
            className="w-full flex-1 resize-none rounded-xl bg-transparent px-3 py-2 text-[16px] text-[#F1F5F9] placeholder:text-[#64748B] outline-none"
            style={{ minHeight: 240 }}
          />
          <button
            type="submit"
            disabled={submitting || demoLoading}
            className="btn-neon w-full shrink-0 px-6 py-4 text-[15px] disabled:opacity-60"
          >
            {submitting ? 'Loading…' : demoLoading ? '✍️ Writing your script…' : user ? 'Generate My Short →' : 'Write My Script — free, no signup →'}
          </button>

          {/* AI Avatar entry removed from the home Short box (16/06) — Avatar and
              Short are separate flows; AI Avatar lives on /avatar via the top menu. */}
        </form>
        {/* Landing demo (13/06) — the script materializes HERE, on the page,
            before any signup. The render is the gate, not the magic. */}
        {(demoLoading || demoShown || demoError) && (
          <div className="neon-card mx-auto mt-4 w-full max-w-[760px] p-5 text-left">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#A78BFA' }}>
                ⚡ Your script — written live by ShortAI
              </span>
              {demoShown && demoScript && demoShown.length >= demoScript.length && (
                <span className="text-[11px] font-bold" style={{ color: 'var(--muted)' }}>done in seconds, not hours</span>
              )}
            </div>
            {demoError ? (
              <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}>⚠️ {demoError}</p>
            ) : (
              <pre
                className="whitespace-pre-wrap text-[13.5px] leading-relaxed"
                style={{ fontFamily: 'inherit', color: 'var(--text2)', margin: 0, minHeight: 60 }}
              >
                {demoShown}
                {(demoLoading || (demoScript && demoShown.length < demoScript.length)) && (
                  <span className="animate-pulse-dot" style={{ color: '#A78BFA' }}>▌</span>
                )}
              </pre>
            )}
            {demoScript && demoShown.length >= demoScript.length && !demoError && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => { trackHomepageEvent('hero_demo_render_cta'); goToGenerate() }}
                  className="btn-neon px-5 py-3 text-[14px]"
                >
                  🎬 Turn this into a video — free (40 credits)
                </button>
                <button
                  type="button"
                  onClick={() => { setDemoScript(null); setDemoShown(''); setPromptText('') }}
                  className="rounded-xl px-4 py-3 text-[13px] font-bold"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--muted2)', cursor: 'pointer' }}
                >
                  ↺ Try another topic
                </button>
              </div>
            )}
          </div>
        )}

        <style jsx>{`
          .sfa-home-avatar {
            background: linear-gradient(135deg, rgba(139,92,246,0.16), rgba(20,184,166,0.14));
            border: 1.5px solid rgba(139,92,246,0.5);
          }
          .sfa-home-avatar:hover { background: linear-gradient(135deg, rgba(139,92,246,0.24), rgba(20,184,166,0.2)); transform: translateY(-1px); }
        `}</style>

        {/* #374 — Task 2: kill blank-canvas paralysis. Clickable example chips +
            a zero-cost "Surprise me" that fills the box from a curated viral-topic
            bank. The textarea stays free for any custom topic. */}
        <div className="mx-auto mt-3 flex w-full max-w-[760px] flex-wrap items-center justify-center gap-2">
          {HOME_CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => { setPromptText(c.value); trackHomepageEvent('hero_chip_click') }}
              className="rounded-full border border-[rgba(167,139,250,0.22)] bg-[#131316] px-3.5 py-2 text-[13px] font-semibold text-[#CBD5E1] transition hover:border-cyan-400/60 hover:bg-[#17171A] hover:text-white"
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setPromptText(randomTopic(prompt)); trackHomepageEvent('hero_surprise_me') }}
            className="rounded-full border border-cyan-400/50 bg-cyan-400/10 px-3.5 py-2 text-[13px] font-bold text-cyan-300 transition hover:bg-cyan-400/20"
          >
            🎲 Surprise me
          </button>
        </div>

        {/* Push #116 — three mini-testimonials and a creator-community
            line right after the hero CTA. The card shapes mirror the
            social-proof bar style used elsewhere on the page. */}
        <div
          className="mx-auto mt-10 grid w-full max-w-5xl gap-3 sm:grid-cols-3"
        >
          {[
            {
              initials: 'RF',
              accent: '#22D3EE',
              quote: 'Made $2,400 last month from my Shorts channel',
              handle: '@ryan_finance',
              subs: '47K subs',
            },
            {
              initials: 'MT',
              accent: '#A78BFA',
              quote: 'I post 3 Shorts/day without touching a camera',
              handle: '@moneywithtom',
              subs: '28K subs',
            },
            {
              initials: 'CF',
              accent: '#A78BFA',
              quote: 'Best money I spend every month',
              handle: '@cryptofactss',
              subs: '91K subs',
            },
          ].map((t) => (
            <div
              key={t.handle}
              className="neon-card p-4 text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  aria-hidden
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-black"
                  style={{
                    background: `${t.accent}22`,
                    border: `1px solid ${t.accent}55`,
                    color: t.accent,
                    letterSpacing: '.02em',
                  }}
                >
                  {t.initials}
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-[#F1F5F9]">{t.handle}</span>
                  <span className="text-[11px] font-bold text-[#A78BFA]">{t.subs}</span>
                </div>
              </div>
              <p className="text-[13.5px] text-[#F1F5F9] leading-snug">
                &ldquo;{t.quote}&rdquo;
              </p>
            </div>
          ))}
        </div>

        {/* Push #116 — "As seen in" community row. Plain text only —
            no logos to chase down or licensing to navigate. */}
        <div className="mx-auto mt-6 max-w-3xl">
          <p className="text-center text-[12px] font-semibold text-[#94A3B8]">
            Creators from these communities use ShortsForge:{' '}
            <span className="text-[#F1F5F9]">
              Reddit · Twitter/X · YouTube · TikTok · Discord
            </span>
          </p>
        </div>
      </section>
      </div>{/* end hero background video wrapper */}

      {/* Push #248 — Real Output section removed entirely (heading + video).
          User did not like this section. */}

      {/* ───────── #490: cinematic moving-video wall (original, fits the dark/cyan house style) ───────── */}
      {/* video wall removido */}

      {/* ───────── AI Video Showcase ───────── */}
      {/* ───────── Push #080: 3×2 showcase grid — bigger cards, cleaner header ───── */}
      <section id="showcase" className="relative z-10 mx-auto max-w-6xl px-4 pt-8 pb-14 sm:px-6">
        <div className="mb-10 text-center">
          <div
            className="mb-3 text-[11px] font-extrabold uppercase tracking-[.18em] text-cyan-400 flex items-center justify-center gap-3"
          >
            <span style={{ display: 'inline-block', width: 24, height: 1, background: '#22D3EE' }} />
            Real AI Output — No Editing Required
            <span style={{ display: 'inline-block', width: 24, height: 1, background: '#22D3EE' }} />
          </div>
          <h2 className="font-display text-balance text-3xl font-bold tracking-tight sm:text-4xl text-[var(--text)] mb-3">
            This is what your AI{' '}
            <span style={{ background: 'linear-gradient(135deg,#22D3EE,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              generates in 60s.
            </span>
          </h2>
          <p className="mx-auto max-w-lg text-[14px] text-[#94A3B8] leading-relaxed">
            Each Short below was created from a single topic — AI wrote the script, recorded the voiceover, picked the footage and added captions automatically.
          </p>
        </div>

        {/* 3 columns × 2 rows grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '16px',
          }}
          className="sm:gap-5"
        >
          {SHOWCASE_BASE.map((base, i) => {
            const card: ShowcaseCard = { ...base, videoUrl: showcaseVideos[`${i}`] ?? '' }
            return (
              <ShowcaseVideoCard
                key={card.title}
                card={card}
                onGenerate={() => goToShowcase(card.prompt)}
              />
            )
          })}
        </div>
      </section>

      {/* ───────── Social Proof ─────────
          Push #097 — compact dark bar instead of the prior 3-card grid.
          Sits right under the hero so the visitor sees a creator count
          + a star quote before they even reach the showcase. */}
      <section className="relative z-10 mx-auto max-w-4xl px-4 pt-0 pb-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl border border-white/[0.08] bg-[#121214] px-5 py-3">
          <span className="text-[13.5px] font-bold text-[#F1F5F9]">
            ⚡ Join 300+ creators generating Shorts with AI
          </span>
          <span aria-hidden className="hidden h-4 w-px bg-white/10 sm:block" />
          {/* Push #104 — live counter pulled from /api/stats. */}
          <span className="text-[13.5px] font-bold text-[#A78BFA]">
            ⚡ {shortsToday.toLocaleString('en-US')} Shorts created today
          </span>
          <span aria-hidden className="hidden h-4 w-px bg-white/10 sm:block" />
          <span className="flex items-center gap-2 text-[13.5px] text-[#94A3B8]">
            <span className="font-black tracking-widest text-[#FBBF24]">★★★★★</span>
            <span className="text-[#F1F5F9]">&ldquo;Saves me 3 hours per video&rdquo;</span>
            <span className="text-cyan-400 font-bold">— @moneyfacts_creator</span>
          </span>
        </div>
      </section>

      {/* ───────── How It Works ─────────
          Push #086 — 3-step explainer between showcase and pricing.
          Anchor id="how-it-works" matches the hero's "See How It Works"
          secondary CTA. Each step is one verb + one outcome — no fluff. */}
      <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl px-4 pt-4 pb-12 sm:px-6 sm:pb-16">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            How it works
          </div>
          <h2 className="font-display text-balance text-3xl font-bold tracking-tight sm:text-4xl text-[var(--text)]">
            Three steps to a faceless Short
          </h2>
        </div>
        {/* Push #231 — connector line behind the steps (desktop only). It
            sits behind the opaque cards and shows through the gaps, so the
            three steps read as a single left-to-right flow. */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 md:block"
            style={{ background: 'linear-gradient(90deg, transparent 0%, #22D3EE55 20%, #8B5CF655 50%, #A78BFA55 80%, transparent 100%)' }}
          />
          <div className="relative grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                icon: '🎯',
                title: 'Enter your idea',
                body: 'One sentence — a topic, a fact, a hook. That’s all it takes.',
                accent: '#22D3EE',
              },
              {
                icon: '🤖',
                title: 'AI creates script, voice, captions & B-roll',
                body: 'Hook, script, narration, captions and B-roll — stitched into a vertical short.',
                accent: '#8B5CF6',
              },
              {
                icon: '📥',
                title: 'Download your Short',
                body: 'Faceless Short ready for YouTube Shorts, TikTok & Reels. Just download and post.',
                accent: '#A78BFA',
              },
            ].map((step, i) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-white/[0.08] bg-[#121214] p-6 transition hover:border-violet-500/50 hover:shadow-[0_0_24px_rgba(34,211,238,0.18)]"
              >
                <div
                  className="absolute -top-3 left-5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.12em]"
                  style={{ background: '#121214', border: `1px solid ${step.accent}55`, color: step.accent }}
                >
                  Step {i + 1}
                </div>
                <div className="text-4xl mb-3 mt-2">{step.icon}</div>
                <h3 className="text-lg font-black text-[#F1F5F9] mb-2">{step.title}</h3>
                <p className="text-[13.5px] text-[#94A3B8] leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Testimonials (Push #231) ─────────
          Real-result creator quotes with avatars (UI Avatars), star
          ratings and a highlighted concrete outcome. Sits right before
          pricing so the visitor reads proof before the buy decision. */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            Testimonials
          </div>
          <h2 className="font-display text-balance text-3xl font-bold tracking-tight sm:text-4xl text-[var(--text)]">
            What creators are saying
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              name: 'João M.',
              niche: 'Finance creator',
              result: 'Went from 200 to 8,400 views per Short',
              quote: 'I posted for months with almost no traction. Now every Short pulls thousands of views — the AI hooks just work.',
            },
            {
              name: 'Sarah K.',
              niche: 'History creator',
              result: 'First viral Short hit 1.2M views',
              quote: 'I type one idea and get a finished video back. My channel finally took off in my first week using it.',
            },
            {
              name: 'Marcus T.',
              niche: 'Crypto creator',
              result: '+12,000 subscribers in 30 days',
              quote: 'Three Shorts a day without ever opening an editor. Best tool I have added to my workflow this year.',
            },
          ].map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#121214] p-6 transition hover:border-violet-500/50 hover:shadow-[0_0_24px_rgba(34,211,238,0.15)]"
            >
              <div aria-hidden className="mb-3 text-[15px] tracking-widest text-[#FBBF24]">★★★★★</div>
              <p className="flex-1 text-[14px] leading-relaxed text-[#F1F5F9]">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-4 rounded-lg border border-violet-500/25 bg-violet-500/[0.07] px-3 py-2 text-[13px] font-extrabold text-[#A78BFA]">
                📈 {t.result}
              </div>
              <div className="mt-4 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=random&size=80`}
                  alt={t.name}
                  width={40}
                  height={40}
                  loading="lazy"
                  className="h-10 w-10 rounded-full border border-white/10"
                />
                <div className="flex flex-col leading-tight">
                  <span className="text-[13.5px] font-bold text-[#F1F5F9]">{t.name}</span>
                  <span className="text-[12px] text-[#94A3B8]">{t.niche}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── How we compare (15/06) ─────────
          Market insight: OpusClip/Submagic repurpose footage you already have,
          HeyGen is avatar-first at $89/mo, and most cap you by minutes. Our
          edge is the FULL pipeline from one idea, no per-minute caps, lower
          price. Surfaced right before Pricing so "more for less" lands at the
          moment of decision. Additive section, factual. */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 pt-8 pb-4 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            How we compare
          </div>
          <h2 className="font-display text-balance text-3xl font-bold tracking-tight sm:text-4xl text-[var(--text)]">
            One idea in. A finished Short out.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] text-[#94A3B8]">
            Most tools clip footage you already filmed or cap you by the minute.
            ShortsForgeAI writes the script, narrates it, finds the footage and
            renders the 9:16 video — from a single idea.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#121214]/80">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="px-4 py-4 text-[13px] font-semibold text-[#94A3B8]"></th>
                <th className="px-4 py-4 text-center">
                  <span className="text-[14px] font-extrabold text-[#A78BFA]">ShortsForgeAI</span>
                </th>
                <th className="px-4 py-4 text-center text-[13px] font-bold text-[#CBD5E1]">OpusClip</th>
                <th className="px-4 py-4 text-center text-[13px] font-bold text-[#CBD5E1]">HeyGen</th>
                <th className="px-4 py-4 text-center text-[13px] font-bold text-[#CBD5E1]">Submagic</th>
              </tr>
            </thead>
            <tbody className="text-[13.5px]">
              {[
                { feat: 'Generates the script from just an idea', us: '✓', a: '—', b: '~', c: '—' },
                { feat: 'AI voiceover included', us: '✓', a: '—', b: '✓', c: '—' },
                { feat: 'Finds & matches the footage for you', us: '✓', a: 'clips your upload', b: 'avatar only', c: 'your upload' },
                { feat: 'Renders a ready-to-post 9:16 video', us: '✓', a: '✓', b: '✓', c: '✓' },
                { feat: 'Auto-writes your YouTube title, description & hashtags', us: '✓', a: '~', b: '—', c: '+$12/mo' },
                { feat: 'No per-minute caps', us: '✓', a: '—', b: 'credit-based', c: '—' },
                { feat: 'Try it free — no credit card', us: '✓', a: '✓', b: '✓', c: 'limited' },
                { feat: 'Starting price', us: '$9.90/mo', a: '$15/mo', b: '$29/mo', c: '$14/mo' },
              ].map((row, i) => (
                <tr key={i} className="border-b border-white/[0.05] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#E2E8F0]">{row.feat}</td>
                  <td className="px-4 py-3 text-center font-extrabold text-[#A78BFA]">{row.us}</td>
                  <td className="px-4 py-3 text-center text-[#94A3B8]">{row.a}</td>
                  <td className="px-4 py-3 text-center text-[#94A3B8]">{row.b}</td>
                  <td className="px-4 py-3 text-center text-[#94A3B8]">{row.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center text-[11.5px] text-[#64748B]">
          Competitor pricing and features as publicly listed (June 2026); plans and limits may change.
        </p>

        {/* ───────── Monetization-safe (16/06) ─────────
            Market insight: YouTube's inauthentic-content policy (Jan 2025) is
            demonetizing mass auto-posted faceless channels. Buyers' #1 fear.
            Our angle: original script per idea, human stays in control, you
            review and post yourself — we are a creation tool, not an
            auto-poster. Additive reassurance strip below the compare table. */}
        <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-violet-400/20 bg-violet-400/[0.04] px-5 py-5 text-center">
          <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#A78BFA]">
            Built for the new YouTube
          </div>
          <p className="text-[14.5px] leading-relaxed text-[#CBD5E1]">
            YouTube now demonetizes mass-produced, auto-posted channels.
            ShortsForgeAI writes an <span className="font-semibold text-[#F1F5F9]">original script for every idea</span> and
            hands you a finished video to <span className="font-semibold text-[#F1F5F9]">review and post yourself</span> —
            you stay in control of what goes out. It&apos;s a creation tool, not an auto-poster.
          </p>
        </div>

        {/* ───────── Cost anchor (20/06) ─────────
            Market insight (June 2026): AI collapsed faceless-Short production
            to a few dollars per video, yet buyers still price it against what
            a human charges. Anchoring our monthly price against the per-clip
            cost of a freelancer/agency makes "more for less" concrete right
            before Pricing. Ranges are public market rates, not competitor
            per-Short claims — kept as ranges to stay factual. Additive. */}
        <div className="mx-auto mt-6 max-w-3xl">
          <div className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            What one finished Short costs
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.08] bg-[#121214]/80 px-5 py-5 text-center">
              <div className="text-[12px] font-semibold text-[#94A3B8]">Freelance editor</div>
              <div className="mt-1 text-2xl font-extrabold text-[#CBD5E1]">$15–40</div>
              <div className="mt-1 text-[12px] text-[#64748B]">per clip · you still write &amp; voice it</div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#121214]/80 px-5 py-5 text-center">
              <div className="text-[12px] font-semibold text-[#94A3B8]">Short-form agency</div>
              <div className="mt-1 text-2xl font-extrabold text-[#CBD5E1]">$30–80</div>
              <div className="mt-1 text-[12px] text-[#64748B]">per clip · slow turnaround</div>
            </div>
            <div className="rounded-2xl border border-violet-400/30 bg-violet-400/[0.06] px-5 py-5 text-center shadow-[0_0_24px_rgba(139,92,246,0.12)]">
              <div className="text-[12px] font-extrabold text-[#A78BFA]">ShortsForgeAI</div>
              <div className="mt-1 text-2xl font-extrabold text-[#A78BFA]">from $9.90</div>
              <div className="mt-1 text-[12px] text-[#94A3B8]">a whole month of Shorts · script, voice &amp; footage included</div>
            </div>
          </div>
          <p className="mt-3 text-center text-[11.5px] text-[#64748B]">
            Freelancer and agency figures are typical market rates for a comparable short-form clip (June 2026).
          </p>
        </div>
      </section>

      {/* ───────── Pricing ───────── */}
      <section id="pricing" className="relative z-10 mx-auto max-w-5xl px-4 pt-8 pb-8 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            Pricing
          </div>
          <h2 className="font-display text-balance text-3xl font-bold tracking-tight sm:text-4xl text-[var(--text)]">
            Choose a plan
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] text-[#94A3B8]">
            Three plans, from $9.90/month. Real AI-generated Shorts — script, voice, and edit done for you.
          </p>
        </div>
        {/* #382 — monthly / annual billing toggle (mirrors /pricing) */}
        <div className="mb-7 flex items-center justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setPricingBilling('monthly')}
              className={`rounded-full px-4 py-1.5 text-[13px] font-extrabold transition ${
                pricingBilling === 'monthly' ? 'bg-[#7C3AED] text-white' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setPricingBilling('annual')}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-extrabold transition ${
                pricingBilling === 'annual' ? 'bg-[#7C3AED] text-white' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Annual
              <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-black text-violet-300">
                2 MONTHS FREE
              </span>
            </button>
          </div>
        </div>
        {/* Push #339 — 3-col grid: Spark + Basic + Pro */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:max-w-4xl md:mx-auto">
          {PLAN_LIST.map((plan) => {
            const isSelected = selectedPlan === plan.tier
            const isRecommended = !!plan.recommended
            const planHref = plan.href
            const isExternal = planHref.startsWith('http')

            const features = featureListFor(plan.tier)
            const ctaLabel = isSelected
              ? plan.tier === 'starter' ? 'Continue with Starter' : plan.tier === 'basic' ? 'Continue with Creator' : 'Continue with Studio'
              : plan.cta

            return (
              <div
                key={plan.tier}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedPlan(plan.tier as 'starter' | 'basic' | 'pro')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedPlan(plan.tier as 'starter' | 'basic' | 'pro')
                  }
                }}
                className={`group relative flex flex-col rounded-2xl border p-6 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-2 border-[#8B5CF6] bg-[#0D1830] shadow-[0_0_28px_rgba(139,92,246,0.3)]'
                    : isRecommended
                      ? 'border-violet-500 bg-[#121214] shadow-[0_0_30px_rgba(139,92,246,0.15)] hover:border-[#8B5CF6] hover:bg-[rgba(34,211,238,0.06)] hover:shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                      : 'border-white/[0.08] bg-[#121214] hover:border-[#8B5CF6] hover:bg-[rgba(34,211,238,0.06)] hover:shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                }`}
              >
                {isRecommended && !isSelected && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#7C3AED] px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white shadow-[0_4px_18px_rgba(139,92,246,.45)]">
                    Recommended
                  </div>
                )}
                {isSelected && (
                  <div className="absolute -top-3 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-[#22C55E] text-white shadow-[0_4px_14px_rgba(34,197,94,.45)]" aria-label="Selected">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#94A3B8]">
                  {plan.name}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[2.4rem] font-black leading-none tracking-tight text-[#F1F5F9]">
                    {pricingBilling === 'annual' && plan.annualPerMonthLabel ? plan.annualPerMonthLabel : plan.priceLabel}
                  </span>
                </div>
                <div className="mt-1 text-[12.5px] font-semibold text-cyan-400">
                  {pricingBilling === 'annual' && plan.annualPriceLabel
                    ? `/ month · billed annually (${plan.annualPriceLabel}/yr)`
                    : plan.periodLabel}
                </div>
                <ul className="mt-5 mb-6 flex flex-col gap-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13.5px] text-[#F1F5F9]">
                      <span className="mt-[3px] text-cyan-400">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {/* Push #276 — all plans are paid, single button variant */}
                <button
                  type="button"
                  disabled={checkoutTier !== null && checkoutTier !== plan.tier}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedPlan(plan.tier as 'starter' | 'basic' | 'pro')
                    handleStartPlan(plan.tier as 'starter' | 'basic' | 'pro')
                  }}
                  className={`mt-auto block w-full rounded-xl px-4 py-3 text-center text-[14px] font-extrabold transition disabled:opacity-60 ${
                    isRecommended || isSelected
                      ? 'bg-[#7C3AED] text-white shadow-[0_8px_24px_rgba(139,92,246,.4)] hover:bg-violet-500 hover:shadow-[0_10px_32px_rgba(34,211,238,.4)]'
                      : 'border border-white/[0.08] text-[#F1F5F9] hover:bg-white/5 hover:border-violet-500/40'
                  }`}
                >
                  {checkoutTier === plan.tier ? 'Starting…' : `${ctaLabel} →`}
                </button>
                {/* Push #276 — per-tier value highlight (paid plans only) */}
                <p className="mt-3 text-center text-[12px] font-bold text-cyan-400">
                  {plan.tier === 'starter' && '⚡ 50 Fast videos/month'}
                  {plan.tier === 'basic' && '✨ 6 AI-generated videos/month (Seedance)'}
                  {plan.tier === 'pro' && '🎬 ~4 cinematic AI videos/month (Kling)'}
                </p>
                <p className="mt-1 text-center text-[11.5px] font-semibold text-[#94A3B8]">
                  7-day money-back guarantee · Cancel anytime
                </p>
              </div>
            )
          })}
        </div>

        {/* Push #231 — money-back guarantee badge under the pricing CTAs. */}
        <div className="mx-auto mt-7 flex max-w-xl items-center justify-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/[0.06] px-5 py-4 text-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="shrink-0">
            <path d="M12 2l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5l8-3z" fill="#8B5CF622" stroke="#A78BFA" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8.5 12l2.5 2.5L16 9.5" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-left">
            <p className="text-[14px] font-extrabold text-[#A78BFA]">7-day money-back guarantee</p>
            <p className="text-[12.5px] text-[#94A3B8]">
              Not happy with your first video? We&apos;ll refund you. No questions asked.
            </p>
          </div>
        </div>

        {checkoutError && (
          <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] font-semibold text-[#f87171]">
            {checkoutError}
          </p>
        )}

        {/* Push #171 — already subscribed info banner */}
        {alreadySubscribed && (
          <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-violet-500/30 bg-violet-500/[0.07] px-5 py-4 text-center">
            <p className="text-[13px] font-bold text-violet-400">
              ✅ You already have an active subscription!
            </p>
            <p className="mt-1 text-[12px] text-[#94A3B8]">
              Your plan is active. Credits may still be syncing.
            </p>
            <a
              href="/generate"
              className="mt-3 inline-block rounded-lg bg-violet-500 px-5 py-2 text-[13px] font-extrabold text-white shadow-[0_4px_14px_rgba(167,139,250,.35)] transition hover:bg-violet-400"
            >
              Go to Dashboard →
            </a>
          </div>
        )}

        <p className="mx-auto mt-6 max-w-2xl text-center text-[12px] text-[#94A3B8]">
          Credits are charged only when your final video is successfully generated.
        </p>
      </section>

      {/* ───────── FAQ (Push #231) ─────────
          Objection-handling accordion right before the final CTA. Uses
          native <details>/<summary> for accessible, JS-free expand/collapse;
          the +→× rotation is driven by the group-open variant. */}
      <section className="relative z-10 mx-auto max-w-3xl px-4 pt-12 pb-4 sm:px-6 sm:pt-16">
        <div className="mb-9 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            FAQ
          </div>
          <h2 className="font-display text-balance text-3xl font-bold tracking-tight sm:text-4xl text-[var(--text)]">
            Questions, answered
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {[
            {
              q: 'Does it work for my niche?',
              a: 'Yes — it works for any niche. Finance, history, crypto, fitness, true crime, motivation and more. Just type your topic and the AI adapts the script and footage to fit.',
            },
            {
              q: 'Do I need to edit the video after?',
              a: 'No. Every Short comes out fully edited — script, voiceover, captions and music included. It is ready to upload as-is.',
            },
            {
              q: 'Is it safe to pay here?',
              a: 'Yes. All payments are processed by Stripe with bank-level encryption. We never see or store your card details.',
            },
            {
              q: 'How long does it take?',
              a: 'About 35 seconds. You type an idea and your finished vertical Short is ready to download.',
            },
            {
              q: 'Can I cancel anytime?',
              a: 'Yes — there is no contract. Cancel in one click whenever you want and you keep access until the end of your billing period.',
            },
          ].map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border border-white/[0.08] bg-[#121214] px-5 py-4 transition hover:border-violet-500/40 open:border-violet-500/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-bold text-[#F1F5F9] [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden
                  className="text-xl leading-none text-cyan-400 transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-[#94A3B8]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ───────── Final CTA ─────────
          Push #086 — dark gradient card before the footer to capture the
          visitor who scrolled all the way down. Primary CTA routes through
          goToGenerate so signed-in users skip /signup; secondary jumps
          back to #pricing. */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-12 pb-4 sm:px-6 sm:pt-16">
        <div
          className="relative overflow-hidden rounded-3xl border border-violet-500/30 p-10 text-center sm:p-14"
          style={{
            background:
              'linear-gradient(135deg, rgba(34,211,238,0.10) 0%, rgba(11,17,32,0.95) 50%, rgba(5,150,105,0.12) 100%)',
            boxShadow: '0 0 60px rgba(34,211,238,0.15) inset, 0 18px 50px rgba(0,0,0,0.45)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full opacity-30"
            style={{ background: '#22D3EE', filter: 'blur(120px)' }}
          />
          <h2 className="font-display relative text-balance text-3xl font-bold tracking-tight sm:text-4xl text-[var(--text)]">
            Ready to Scale Your Channel?
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-[15px] text-[#94A3B8]">
            Join 300+ creators generating viral Shorts on autopilot.
          </p>
          <div className="relative mx-auto mt-7 flex w-full max-w-md flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => goToGenerate()}
              disabled={submitting}
              className="w-full sm:w-auto rounded-xl bg-[#7C3AED] px-7 py-4 text-base font-extrabold text-white shadow-[0_8px_28px_rgba(139,92,246,.4)] transition hover:bg-violet-500 hover:shadow-[0_10px_36px_rgba(34,211,238,.45)] disabled:opacity-60"
            >
              Start Free Today
            </button>
            <a
              href="#pricing"
              className="w-full sm:w-auto rounded-xl border border-white/[0.18] px-7 py-4 text-base font-extrabold text-[#F1F5F9] transition hover:border-cyan-400/60 hover:bg-white/[0.04]"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* ───────── Exit-intent survey (Push #232) ─────────
          A lightweight "why are you leaving?" survey: 3 quick reasons + an
          optional comment, POSTed to /api/exit-feedback. Fade-in backdrop +
          slide-up card; dark theme, cyan border, backdrop blur. */}
      {showExitIntent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-survey-title"
          onClick={() => setShowExitIntent(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-5 backdrop-blur-md"
          style={{ animation: 'sf-exit-fade .2s ease-out' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl border-2 border-cyan-400/40 bg-[#121214] p-8 shadow-[0_30px_80px_rgba(0,0,0,.7),0_0_60px_rgba(34,211,238,.25)]"
            style={{ animation: 'sf-exit-pop .28s cubic-bezier(.16,1,.3,1)' }}
          >
            <button
              type="button"
              onClick={() => setShowExitIntent(false)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[#94A3B8] hover:text-[#F1F5F9]"
            >
              ×
            </button>
            <h2
              id="exit-survey-title"
              className="text-balance text-2xl font-black tracking-tight text-[#F1F5F9]"
            >
              Wait — before you go 👋
            </h2>
            {!leadDone ? (
              <>
                <p className="mt-2 text-[14px] text-[#94A3B8]">
                  Grab <span className="font-bold text-[#22D3EE]">10 viral Short ideas</span> for your niche — free. Drop your email and they&apos;re yours.
                </p>
                <input
                  type="email"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitLead() }}
                  placeholder="you@email.com"
                  className="mt-5 w-full rounded-xl border border-white/[0.1] bg-white/[0.02] px-4 py-3 text-[15px] text-[#F1F5F9] placeholder:text-[#64748B] outline-none transition focus:border-cyan-400/60"
                />
                <button
                  type="button"
                  onClick={submitLead}
                  disabled={exitSubmitting}
                  className="mt-4 w-full rounded-xl bg-[#22D3EE] px-6 py-3.5 text-[15px] font-extrabold text-[#0A0A0B] shadow-[0_8px_28px_rgba(34,211,238,.35)] transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {exitSubmitting ? 'Sending…' : 'Get my 10 viral ideas →'}
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-[14px] text-[#94A3B8]">
                  Here you go — 10 ideas that tend to blow up 🎬 Make any of them free in the app.
                </p>
                <ul className="mt-4 flex flex-col gap-2 text-left">
                  {VIRAL_IDEAS.map((idea, i) => (
                    <li key={i} className="flex gap-2 text-[13.5px] text-[#CBD5E1]">
                      <span className="shrink-0 font-bold text-[#22D3EE]">{i + 1}.</span> {idea}
                    </li>
                  ))}
                </ul>
                <a
                  href="/signup"
                  className="mt-5 block w-full rounded-xl bg-[#22D3EE] px-6 py-3.5 text-center text-[15px] font-extrabold text-[#0A0A0B] shadow-[0_8px_28px_rgba(34,211,238,.35)] transition hover:bg-cyan-300"
                >
                  Make one free now →
                </a>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowExitIntent(false)}
              className="mt-3 block w-full text-center text-[13px] font-semibold text-[#94A3B8] underline hover:text-[#F1F5F9]"
            >
              Actually, I&apos;ll stay
            </button>
          </div>
          <style>{`
            @keyframes sf-exit-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes sf-exit-pop { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes waveBar { from { transform: scaleY(0.4); } to { transform: scaleY(1.4); } }
          `}</style>
        </div>
      )}

      {/* ───────── Footer ───────── */}
      <footer className="relative z-10 mt-16 border-t border-white/[0.08]">
        {/* Push #252 — full-width footer matching the nav; same px-6 sm:px-10
            padding so both bars align at identical left/right edges. */}
        <div className="flex w-full flex-col items-center gap-4 px-6 py-8 sm:flex-row sm:px-10">
          <div className="flex items-center gap-2.5 sm:min-w-[160px]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#121214] border border-violet-500/40 text-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#22D3EE" />
              </svg>
            </div>
            <span className="text-[13px] font-bold text-[#F1F5F9]">
              <span>ShortsForge</span><span className="text-cyan-400">AI</span>
            </span>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/generate" className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">AI Generator</Link>
            <Link href={THUMBNAIL_ROUTE} className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Thumbnail</Link>
            <Link href="/history" className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">My Videos</Link>
            <Link href="/pricing" className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Pricing</Link>
          </div>
          <p className="text-[11.5px] text-[#94A3B8] sm:min-w-[160px] sm:text-right">© 2026 ShortsForgeAI <span className="opacity-40">· v3.0</span></p>
        </div>
        {/* Push #116 — legal + contact strip under the main footer row. */}
        <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 px-6 pb-6 sm:px-10">
          <Link href="/terms" className="text-[11.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Terms of Service</Link>
          <span aria-hidden className="text-[11.5px] text-[#94A3B8] opacity-40">·</span>
          <Link href="/privacy" className="text-[11.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Privacy Policy</Link>
          <span aria-hidden className="text-[11.5px] text-[#94A3B8] opacity-40">·</span>
          <a href="mailto:support@shortsforgeai.com" className="text-[11.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Contact</a>
        </div>
      </footer>
    </div>
  )
}

// Push #228 — lazily-loaded looping video. The element is always mounted
// (so the IntersectionObserver has a node to watch) but its <source>s and
// network load are deferred until it scrolls within `rootMargin` of the
// viewport. preload="none" + manual play() keeps off-screen clips off the
// network entirely — the homepage was loading every showcase + preview
// clip eagerly, which was the main source of lag.
function LazyVideo({
  sources,
  className,
  style,
}: {
  sources: string[]
  className?: string
  style?: CSSProperties
}) {
  const [inView, setInView] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const srcKey = sources.join('|')

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Once visible (or when the source list resolves while already visible),
  // attach sources, (re)load and play.
  useEffect(() => {
    const el = videoRef.current
    if (!inView || !el) return
    el.load()
    el.play().catch(() => {/* autoplay blocked — first frame still shows */})
  }, [inView, srcKey])

  return (
    <video
      ref={videoRef}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      className={className}
      style={style}
    >
      {inView && sources.map((s) => <source key={s} src={s} type="video/mp4" />)}
    </video>
  )
}

// Showcase card with an embedded looping video poster. The video element
// is the visual heart of the card; the gradient backdrop is both the
// initial paint (before the first frame) and the fallback if the CDN
// fails. We fade the video in on `canplay` to avoid the harsh swap from
// gradient to first-frame-black that some browsers do.
// #490 — Cinematic moving-video WALL. Original component in the existing
// dark/cyan house style (additive, does not replace the showcase grid). A dense
// grid of auto-playing, muted, looping 9:16 clips that gives the "alive" premium
// feel. Each tile lazy-mounts via IntersectionObserver so only on-screen clips load.
function WallTile({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const vref = useRef<HTMLVideoElement | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect() } },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (inView && vref.current) vref.current.play().catch(() => {/* autoplay blocked */})
  }, [inView])
  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-xl border border-white/[0.06] transition-transform duration-300 hover:scale-[1.03]"
      style={{ aspectRatio: '9 / 16', background: '#121214' }}
    >
      {inView && url && (
        <video ref={vref} src={url} autoPlay muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(11,17,32,0.20), rgba(11,17,32,0) 45%, rgba(11,17,32,0.45))' }}
      />
    </div>
  )
}

function VideoWall({ clips }: { clips: string[] }) {
  const valid = clips.filter(Boolean)
  if (valid.length < 3) return null // wait until showcase clips have loaded
  const tiles = Array.from({ length: 12 }, (_, i) => valid[i % valid.length])
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 pt-12 pb-2 sm:px-6">
      <div className="mb-6 text-center">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-cyan-400">100% generated with AI</div>
        <h2 className="text-2xl font-black text-white sm:text-3xl">A wall of Shorts, made in seconds</h2>
        <p className="mt-2 text-sm text-white/50">Every clip below was generated — no filming, no editing.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {tiles.map((url, i) => (<WallTile key={i} url={url} />))}
      </div>
    </section>
  )
}

function ShowcaseVideoCard({
  card,
  onGenerate,
}: {
  card: ShowcaseCard
  onGenerate: () => void
}) {
  const [videoFailed, setVideoFailed] = useState(false)
  // Push #131 — removed opacity gating (videoReady/isPlaying states).
  const isPlaying = true // keep for overlay logic compat
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)
  // Caption cycling — rotates through the card's caption lines every 2.5s
  const [captionIdx, setCaptionIdx] = useState(0)
  const [captionVisible, setCaptionVisible] = useState(true)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Play once the clip mounts (it only mounts after inView + a URL exists).
  useEffect(() => {
    if (inView && videoRef.current) {
      videoRef.current.play().catch(() => {/* autoplay blocked */})
    }
  }, [inView, card.videoUrl])

  // Cycle through captions with a fade transition
  useEffect(() => {
    if (!inView) return
    const interval = setInterval(() => {
      setCaptionVisible(false)
      setTimeout(() => {
        setCaptionIdx((prev) => (prev + 1) % card.captions.length)
        setCaptionVisible(true)
      }, 300)
    }, 2800)
    return () => clearInterval(interval)
  }, [inView, card.captions.length])

  return (
    <div ref={cardRef} className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121214] transition-all duration-200 hover:border-violet-500/60 hover:shadow-[0_0_24px_rgba(34,211,238,0.22)]">
      {/* 9:16 vertical preview — matches the YouTube Shorts format the
          rest of the product is built around. */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: '9 / 16',
          background: `linear-gradient(135deg, ${card.accent}22 0%, #121214 70%)`,
        }}
      >
        {/* Gradient poster — always painted, sits behind the video so we
            never show a black box during load and so a failed CDN load
            falls back to the original look. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${card.accent}33, transparent 60%)`,
          }}
        />

        {!videoFailed && card.videoUrl && inView && (
          <video
            ref={videoRef}
            src={card.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            // Push #228 — preload="none" + IntersectionObserver gating
            // (the `inView` guard above). Each clip now loads only when its
            // card scrolls near the viewport instead of all six on mount.
            preload="none"
            onError={() => setVideoFailed(true)}
            className="absolute inset-0 h-full w-full object-cover z-0 group-hover:scale-[1.02] transition-transform duration-500 ease-out"
            style={{ opacity: 1, transform: 'translateZ(0)' }}
          />
        )}

        {/* Dark overlay — z-10, above the video (z-0), below text (z-20) */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              'linear-gradient(180deg, rgba(11,17,32,0.55) 0%, rgba(11,17,32,0) 35%, rgba(11,17,32,0) 65%, rgba(11,17,32,0.65) 100%)',
          }}
        />

        {/* "Generated in Xs" badge — top-right */}
        <div className="absolute top-3 left-3 z-20">
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.1em] backdrop-blur-md"
            style={{
              background: 'rgba(139,92,246,.18)',
              border: '1px solid rgba(139,92,246,.45)',
              color: '#A78BFA',
            }}
          >
            <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#A78BFA', boxShadow: '0 0 6px #A78BFA' }} />
            AI · {card.genTime}s
          </span>
        </div>

        {/* Animated caption overlay — bottom of video, mimics real Short captions.
            Hidden on mobile (sm:) — overlapped the play button and looked
            cluttered on phones; the title below the card carries the message. */}
        <div className="absolute bottom-10 left-0 right-0 z-20 hidden sm:flex justify-center px-3">
          <div
            style={{
              background: 'rgba(0,0,0,0.72)',
              borderRadius: 6,
              padding: '5px 10px',
              maxWidth: '90%',
              textAlign: 'center',
              transition: 'opacity 0.3s ease',
              opacity: captionVisible ? 1 : 0,
            }}
          >
            <span className="text-[11px] sm:text-[12px] font-bold text-white leading-tight">
              {card.captions[captionIdx]}
            </span>
          </div>
        </div>

        {/* Audio waveform animation — bottom right */}
        <div className="absolute bottom-3 right-3 z-20 flex items-end gap-[2px]" aria-hidden>
          {[3, 6, 4, 7, 5, 8, 4, 6, 3].map((h, i) => (
            <div
              key={i}
              style={{
                width: 2,
                height: h,
                borderRadius: 1,
                background: card.accent,
                opacity: 0.8,
                animation: `waveBar 0.9s ease-in-out ${i * 0.08}s infinite alternate`,
              }}
            />
          ))}
        </div>


        {!videoFailed && (
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300 ${
              isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md transition-transform duration-200 group-hover:scale-110"
              style={{
                background: 'rgba(11,17,32,.55)',
                border: `1px solid ${card.accent}66`,
                boxShadow: `0 0 24px ${card.accent}44`,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill={card.accent} />
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <h3 className="text-[14px] sm:text-[15px] font-bold text-[#F1F5F9] leading-snug">{card.title}</h3>
        <p className="hidden text-[12px] text-[#94A3B8] line-clamp-2 sm:block">
          {card.prompt}
        </p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-auto inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-transparent px-3 py-2.5 text-[12px] sm:text-[13px] font-bold text-[#F1F5F9] transition hover:border-violet-500/50 hover:bg-white/[0.04]"
        >
          <span>Generate similar</span>
          <span style={{ color: card.accent }}>→</span>
        </button>
      </div>
    </div>
  )
}

// Marketing feature copy lives next to the home page so it can be tuned
// without touching the canonical PLANS config.
// Push #276 — free tier removed from all marketing surfaces.
function featureListFor(tier: 'free' | 'starter' | 'basic' | 'pro'): string[] {
  if (tier === 'free') {
    return [] // free plan no longer shown
  }
  if (tier === 'starter') {
    return [
      `${PLANS.starter.credits} Fast Mode renders/month`,
      'AI script + neural voiceover pipeline',
      'Auto-captions engine',
      'Watermark-free MP4 output',
      'My Videos history',
    ]
  }
  if (tier === 'basic') {
    return [
      '✨ AI Generated videos (Seedance)',
      `${PLANS.basic.credits} credits/month — 30 per video`,
      'AI script + neural voiceover pipeline',
      'Auto-captions engine',
      'Watermark-free MP4 output',
      'My Videos history',
    ]
  }
  return [
    '🎬 Cinematic AI videos (Kling) — top quality',
    '✨ AI Generated videos (Seedance) included',
    `${PLANS.pro.credits} credits/month — AI Gen 40 · Cinematic 90`,
    'AI script + neural voiceover pipeline',
    'Auto-captions engine',
    'Watermark-free MP4 output',
    'My Videos history',
  ]
}