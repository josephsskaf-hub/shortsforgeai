'use client'

// #467/#469/#470/#472 — "Viral First Short Onboarding" (Measure 2 / P0, activation).
// #472 — final 8.5 → 9.5 polish (conversion + UX + tracking) per spec. Same job:
// a brand-new user lands on /generate and generates their first FREE Short in one
// click — no engine choice, no empty dashboard. Added in #472:
//  - Top copy: value line + "No credit card required" + honest 11.4K proof
//  - Surprise Me → "generate my free Short" (picks the highest-score idea, Fast)
//  - Stronger input ("Type any topic, niche, product or idea…" + "Generate My Free Short")
//  - Niche filter chips (horizontal-scroll on mobile) — filter only, never a form
//  - Highlighted "🔥 Best Pick Right Now" full-width card to kill decision paralysis
//  - 🧠 Why-it-works + explicit "Output: 60s • 9:16 • Voiceover • Captions • Fast"
//  - Inline "Preview hook" that expands the spoken hook inside the card
//  - Whole card clickable; richer funnel events (filter/card/preview/best-pick props)
//  - Mobile rules (compact hero, full-width CTA, stacked input, scrollable chips)
// Self-contained; parent wires onPick/onSurprise/onClose (signature unchanged).
import { useEffect, useRef, useState } from 'react'

const VERTICAL_COLORS: Record<string, string> = {
  money: '#8b5cf6',
  mystery: '#8b5cf6',
  country: '#8b5cf6',
  ai: '#14b8a6',
  psychology: '#ec4899',
  history: '#d97706',
  science: '#14b8a6',
  space: '#0ea5e9',
}
const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  Hot: { bg: 'rgba(239,68,68,0.18)', color: '#ef4444' },
  Trending: { bg: 'rgba(249,115,22,0.18)', color: '#f97316' },
  'High Retention': { bg: 'rgba(139,92,246,0.18)', color: '#8b5cf6' },
  Viral: { bg: 'rgba(139,92,246,0.18)', color: '#8b5cf6' },
}

type Starter = {
  vertical: string
  label: string
  title: string
  hook: string
  previewHook: string
  why: string
  score: number
  badge: keyof typeof BADGE_STYLES
}

// Order is curated for activation/click-through (most instant curiosity first).
// STARTERS[0] is featured as "Best Pick Right Now".
const STARTERS: Starter[] = [
  { vertical: 'mystery', label: 'Mystery', title: 'The disappearance nobody solved in 70 years', hook: '3 people vanished without a trace — and the evidence left behind is more disturbing than the disappearance.', previewHook: 'Three people vanished without a trace. But what they left behind made the case even stranger.', why: 'Mystery + open loop + unsolved case', score: 95, badge: 'Viral' },
  { vertical: 'money', label: 'Money', title: '$200 a month makes you a millionaire — here’s the math', hook: '$200 a month is all it takes. But start after 30 and you pay an $850,000 penalty.', previewHook: 'Saving $200 a month can make you a millionaire — but only if you start before this age.', why: 'Money + concrete numbers + urgency', score: 91, badge: 'High Retention' },
  { vertical: 'country', label: 'Country', title: 'The island where snakes rule everything', hook: 'So many venomous snakes the government bans humans from setting foot on it.', previewHook: 'There’s an island so full of venomous snakes that the government bans anyone from landing.', why: 'Extreme place + danger + curiosity', score: 94, badge: 'Viral' },
  { vertical: 'ai', label: 'AI / Tech', title: 'The AI tool replacing 10 jobs right now', hook: 'One AI tool is already replacing entire teams — and most people still haven’t heard of it.', previewHook: 'One AI tool is quietly doing the work of ten people — and most have never heard of it.', why: 'AI + fear + “you’re missing out”', score: 95, badge: 'Hot' },
  { vertical: 'psychology', label: 'Health', title: 'Why cold showers change your brain in 60 seconds', hook: 'A 60-second cold shower triggers a neurochemical cascade your brain can’t get from coffee.', previewHook: 'Sixty seconds in a cold shower rewires your brain in a way coffee never could.', why: 'Health + quick win + science', score: 91, badge: 'Hot' },
  { vertical: 'history', label: 'History', title: 'Why ancient Rome collapsed in 5 steps', hook: 'The empire that ruled the world fell faster than anyone expected — and the pattern is repeating.', previewHook: 'The empire that ruled the world collapsed in five steps — and we’re repeating them.', why: 'History + listicle + relevance', score: 90, badge: 'High Retention' },
  { vertical: 'science', label: 'Science', title: 'The ocean mystery scientists still can’t explain', hook: 'We’ve mapped 95% of the ocean floor — and what’s down there contradicts everything expected.', previewHook: 'We’ve mapped more of Mars than our own ocean floor — and what’s down there makes no sense.', why: 'Mystery + science + curiosity gap', score: 91, badge: 'High Retention' },
  { vertical: 'space', label: 'Space', title: 'What NASA found on Mars they never announced', hook: 'A signal, a structure, and a long silence — what the rovers captured raised more questions than answers.', previewHook: 'A rover caught something on Mars that NASA still has never explained.', why: 'Space + secrecy + intrigue', score: 96, badge: 'Viral' },
]

const FILTERS: string[] = ['All', ...Array.from(new Set(STARTERS.map((s) => s.label)))]

function track(name: string, metadata?: Record<string, unknown>) {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, metadata }),
      keepalive: true,
    })
  } catch {}
}

type Props = {
  onPick: (topic: string, niche: string) => void
  onSurprise: (topic: string) => void
  onClose: () => void
}

export default function NicheOnboarding({ onPick, onSurprise, onClose }: Props) {
  const [customIdea, setCustomIdea] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [openHook, setOpenHook] = useState<string | null>(null)
  const typedFired = useRef(false)

  useEffect(() => {
    track('viral_onboarding_viewed')
  }, [])

  const COMMON = { source: 'viral_onboarding', engine: 'fast', is_first_video: true }

  function generate(s: Starter, isFeatured: boolean) {
    const props = {
      selected_topic: s.title,
      selected_category: s.vertical,
      selected_score: s.score,
      selected_label: s.badge,
      card_position: STARTERS.indexOf(s),
      is_best_pick: isFeatured,
      filter_selected: activeFilter,
    }
    track('viral_card_clicked', props)
    track('viral_card_generate_clicked', props)
    track('first_video_started_from_viral_onboarding', { ...props, ...COMMON, generated_from_card: true })
    onPick(s.title, s.vertical)
  }

  function surprise() {
    // Pick the single best idea (highest score), not a random one.
    const s = [...STARTERS].sort((a, b) => b.score - a.score)[0]
    track('surprise_me_clicked', { selected_topic: s.title, selected_score: s.score })
    track('first_video_started_from_viral_onboarding', {
      selected_topic: s.title, selected_category: s.vertical, selected_score: s.score,
      ...COMMON, generated_from_surprise: true,
    })
    onSurprise(s.title)
  }

  function generateCustom() {
    const idea = customIdea.trim()
    if (!idea) return
    track('custom_idea_generate_clicked', { selected_topic: idea })
    track('first_video_started_from_viral_onboarding', { selected_topic: idea, ...COMMON, generated_from_custom_input: true })
    onPick(idea, 'custom')
  }

  function onCustomType(v: string) {
    setCustomIdea(v)
    if (!typedFired.current && v.trim()) {
      typedFired.current = true
      track('custom_idea_typed')
    }
  }

  function selectFilter(f: string) {
    setActiveFilter(f)
    setOpenHook(null)
    track('viral_filter_clicked', { filter_selected: f })
  }

  function togglePreview(s: Starter) {
    const next = openHook === s.title ? null : s.title
    setOpenHook(next)
    if (next) track('viral_card_preview_hook_clicked', { selected_topic: s.title, preview_hook_opened: true })
  }

  const showBestPick = activeFilter === 'All'
  const featured = showBestPick ? STARTERS[0] : null
  const gridCards = showBestPick ? STARTERS.slice(1) : STARTERS.filter((s) => s.label === activeFilter)

  function renderCard(s: Starter, isFeatured: boolean) {
    const vertColor = VERTICAL_COLORS[s.vertical] ?? '#14b8a6'
    const badge = BADGE_STYLES[s.badge]
    const hookOpen = openHook === s.title
    return (
      <div
        key={s.title}
        onClick={() => generate(s, isFeatured)}
        style={{
          background: isFeatured
            ? 'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(11,17,32,0.96))'
            : 'var(--card, #121214)',
          border: `1px solid ${isFeatured ? vertColor : 'var(--border, rgba(255,255,255,0.10))'}`,
          borderRadius: 14,
          padding: isFeatured ? '18px 18px' : '16px 16px',
          display: 'flex', flexDirection: 'column', gap: 8,
          gridColumn: isFeatured ? '1 / -1' : 'auto',
          cursor: 'pointer',
          boxShadow: isFeatured ? `0 0 28px ${vertColor}33` : 'none',
          transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => { const t = e.currentTarget as HTMLDivElement; t.style.borderColor = vertColor; t.style.transform = 'translateY(-2px)'; t.style.boxShadow = `0 8px 28px ${vertColor}33` }}
        onMouseLeave={(e) => { const t = e.currentTarget as HTMLDivElement; t.style.borderColor = isFeatured ? vertColor : 'var(--border, rgba(255,255,255,0.10))'; t.style.transform = 'translateY(0)'; t.style.boxShadow = isFeatured ? `0 0 28px ${vertColor}33` : 'none' }}
      >
        {isFeatured && (
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: vertColor, letterSpacing: '0.02em', marginBottom: 2 }}>
            🔥 Best Pick Right Now
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: vertColor + '22', color: vertColor, whiteSpace: 'nowrap' }}>{s.label}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af' }}>🔥 {s.score}</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{s.badge}</span>
        </div>

        <p style={{ margin: 0, fontSize: isFeatured ? '1.18rem' : '1.02rem', fontWeight: 900, lineHeight: 1.25, color: '#F1F5F9', letterSpacing: '-0.01em' }}>{s.title}</p>
        <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: '#9ca3af', lineHeight: 1.45 }}>{s.hook}</p>
        <p style={{ margin: 0, fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 600 }}>
          🧠 <span style={{ color: '#94A3B8', fontWeight: 700 }}>Why it works:</span> {s.why}
        </p>
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.01em' }}>
          Output: 60s • 9:16 • Voiceover • Captions • Fast
        </p>

        {hookOpen && (
          <div style={{ margin: '2px 0', padding: '10px 12px', borderRadius: 10, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.20)' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#E2E8F0', fontStyle: 'italic', lineHeight: 1.5 }}>“{s.previewHook}”</p>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto' }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); generate(s, isFeatured) }}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 9, border: 'none',
              background: `linear-gradient(90deg, ${vertColor}, #ef4444)`, color: '#fff',
              fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          >
            Generate Free Short →
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); togglePreview(s) }}
            style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline' }}
          >
            {hookOpen ? 'Hide hook' : 'Preview hook'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick a viral idea to create your first Short"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(5,7,13,0.94)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '30px 16px 56px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <style>{`
        @media (max-width: 640px) {
          .vo-h1 { font-size: 1.32rem !important; }
          .vo-surprise { max-width: 100% !important; }
          .vo-input-row { flex-direction: column !important; max-width: 100% !important; }
          .vo-input-row button { width: 100% !important; }
        }
        .vo-chips { scrollbar-width: none; }
        .vo-chips::-webkit-scrollbar { height: 0; display: none; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 760 }}>
        {/* Hero */}
        <h1 className="vo-h1" style={{ fontSize: '1.6rem', fontWeight: 900, color: '#F1F5F9', textAlign: 'center', margin: '0 0 6px', lineHeight: 1.2 }}>
          Pick a viral idea. We&apos;ll turn it into a Short.
        </h1>
        <p style={{ fontSize: '0.92rem', color: '#94A3B8', textAlign: 'center', margin: '0 0 4px' }}>
          Your first Short is <b style={{ color: '#22D3EE' }}>free</b>. No credit card required. No script, no voiceover, no editing.
        </p>
        <p style={{ fontSize: '0.8rem', color: '#64748B', textAlign: 'center', margin: '0 0 6px' }}>
          Script • Voiceover • Captions • Visuals • Ready in ~60s
        </p>
        <p style={{ fontSize: '0.76rem', color: '#94A3B8', textAlign: 'center', margin: '0 0 18px' }}>
          Real Shorts, real views — <b style={{ color: '#fbbf24' }}>one reached 11.4K</b>.
        </p>

        {/* Surprise Me */}
        <button
          type="button"
          className="vo-surprise"
          onClick={surprise}
          style={{
            display: 'block', width: '100%', maxWidth: 380, margin: '0 auto 12px',
            padding: '14px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, #22D3EE, #8B5CF6)',
            color: '#0A0A0B', fontWeight: 900, fontSize: '1.02rem', border: 'none', cursor: 'pointer',
          }}
        >
          🎲 Surprise Me — generate my free Short
        </button>

        {/* Type your own idea */}
        <div className="vo-input-row" style={{ display: 'flex', gap: 8, maxWidth: 560, margin: '0 auto 16px' }}>
          <input
            type="text"
            value={customIdea}
            onChange={(e) => onCustomType(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') generateCustom() }}
            placeholder="Type any topic, niche, product or idea…"
            style={{
              flex: 1, padding: '11px 14px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)',
              color: '#F1F5F9', fontSize: '0.9rem', outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={generateCustom}
            style={{
              padding: '11px 18px', borderRadius: 10, border: '1px solid rgba(34,211,238,0.4)',
              background: 'rgba(34,211,238,0.12)', color: '#22D3EE', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Generate My Free Short
          </button>
        </div>

        {/* Niche filter chips (horizontal-scroll on mobile) */}
        <div className="vo-chips" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 2px 10px', margin: '0 0 14px', WebkitOverflowScrolling: 'touch' }}>
          {FILTERS.map((f) => {
            const active = activeFilter === f
            return (
              <button
                key={f}
                type="button"
                onClick={() => selectFilter(f)}
                style={{
                  flex: '0 0 auto', padding: '6px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  border: `1px solid ${active ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  background: active ? 'rgba(34,211,238,0.14)' : 'transparent',
                  color: active ? '#22D3EE' : '#94A3B8',
                  transition: 'all 0.15s',
                }}
              >
                {f}
              </button>
            )
          })}
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {featured && renderCard(featured, true)}
          {gridCards.map((s) => renderCard(s, false))}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{ display: 'block', margin: '22px auto 0', background: 'transparent', border: 'none', color: '#64748B', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
        >
          Skip — I&apos;ll type my own idea
        </button>
      </div>
    </div>
  )
}
