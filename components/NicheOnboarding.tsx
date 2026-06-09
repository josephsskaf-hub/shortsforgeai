'use client'

// #467/#469/#470 — "Viral First Short Onboarding" (Measure 2 / P0, activation).
// Shown to brand-new users on /generate. Rich Viral-Now-style cards (category
// pill + 🔥 score + Trending/Viral badge + title + hook + "why it works" +
// format + gradient "Generate Free Short →"), a big "Surprise Me", and an inline
// "type your own idea" box. One click = generate (Fast engine, zero friction).
// Goal: lift first-video activation (21% → 40%+). Fires the viral-onboarding
// funnel events. Self-contained; parent wires onPick/onSurprise/onClose.
import { useEffect, useState } from 'react'

const VERTICAL_COLORS: Record<string, string> = {
  money: '#10b981',
  mystery: '#8b5cf6',
  country: '#3b82f6',
  ai: '#6366f1',
  psychology: '#ec4899',
  history: '#d97706',
  science: '#14b8a6',
  space: '#0ea5e9',
}
const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  Hot: { bg: 'rgba(239,68,68,0.18)', color: '#ef4444' },
  Trending: { bg: 'rgba(249,115,22,0.18)', color: '#f97316' },
  'High Retention': { bg: 'rgba(59,130,246,0.18)', color: '#3b82f6' },
  Viral: { bg: 'rgba(139,92,246,0.18)', color: '#8b5cf6' },
}

type Starter = {
  vertical: string
  label: string
  title: string
  hook: string
  why: string
  score: number
  badge: keyof typeof BADGE_STYLES
}

const STARTERS: Starter[] = [
  { vertical: 'mystery', label: 'Mystery', title: 'The disappearance nobody solved in 70 years', hook: '3 people vanished without a trace — and the evidence left behind is more disturbing than the disappearance.', why: 'Mystery + open loop + unsolved', score: 95, badge: 'Viral' },
  { vertical: 'money', label: 'Money', title: '$200 a month makes you a millionaire — here’s the math', hook: '$200 a month is all it takes. But start after 30 and you pay an $850,000 penalty.', why: 'Money + concrete numbers + urgency', score: 91, badge: 'High Retention' },
  { vertical: 'country', label: 'Country', title: 'The island where snakes rule everything', hook: 'So many venomous snakes the government bans humans from setting foot on it.', why: 'Extreme place + danger + curiosity', score: 94, badge: 'Viral' },
  { vertical: 'ai', label: 'AI / Tech', title: 'The AI tool replacing 10 jobs right now', hook: 'One AI tool is already replacing entire teams — and most people still haven’t heard of it.', why: 'AI + fear + “you’re missing out”', score: 95, badge: 'Hot' },
  { vertical: 'psychology', label: 'Health', title: 'Why cold showers change your brain in 60 seconds', hook: 'A 60-second cold shower triggers a neurochemical cascade your brain can’t get from coffee.', why: 'Health + quick win + science', score: 91, badge: 'Hot' },
  { vertical: 'history', label: 'History', title: 'Why ancient Rome collapsed in 5 steps', hook: 'The empire that ruled the world fell faster than anyone expected — and the pattern is repeating.', why: 'History + listicle + relevance', score: 90, badge: 'High Retention' },
  { vertical: 'science', label: 'Science', title: 'The ocean mystery scientists still can’t explain', hook: 'We’ve mapped 95% of the ocean floor — and what’s down there contradicts everything expected.', why: 'Mystery + science + curiosity gap', score: 91, badge: 'High Retention' },
  { vertical: 'space', label: 'Space', title: 'What NASA found on Mars they never announced', hook: 'A signal, a structure, and a long silence — what the rovers captured raised more questions than answers.', why: 'Space + secrecy + intrigue', score: 96, badge: 'Viral' },
]

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

  useEffect(() => {
    track('viral_onboarding_viewed')
  }, [])

  function generate(s: Starter) {
    track('viral_card_generate_clicked', { selected_topic: s.title, selected_category: s.vertical, selected_score: s.score, selected_label: s.badge })
    track('first_video_started_from_viral_onboarding', { selected_topic: s.title, selected_category: s.vertical, selected_score: s.score, selected_label: s.badge, source: 'viral_onboarding', engine: 'fast', is_first_video: true })
    onPick(s.title, s.vertical)
  }
  function surprise() {
    const s = STARTERS[Math.floor(Math.random() * STARTERS.length)]
    track('surprise_me_clicked', { selected_topic: s.title })
    track('first_video_started_from_viral_onboarding', { selected_topic: s.title, source: 'surprise_me', engine: 'fast', is_first_video: true })
    onSurprise(s.title)
  }
  function generateCustom() {
    const idea = customIdea.trim()
    if (!idea) return
    track('custom_idea_generate_clicked', { selected_topic: idea })
    track('first_video_started_from_viral_onboarding', { selected_topic: idea, source: 'custom_idea', engine: 'fast', is_first_video: true })
    onPick(idea, 'custom')
  }
  function onCustomType(v: string) {
    setCustomIdea(v)
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
      <div style={{ width: '100%', maxWidth: 760 }}>
        {/* Hero */}
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#F1F5F9', textAlign: 'center', margin: '0 0 6px', lineHeight: 1.2 }}>
          Pick a viral idea. We&apos;ll turn it into a Short.
        </h1>
        <p style={{ fontSize: '0.92rem', color: '#94A3B8', textAlign: 'center', margin: '0 0 4px' }}>
          Your first Short is <b style={{ color: '#22D3EE' }}>free</b>. No script, no voiceover, no editing.
        </p>
        <p style={{ fontSize: '0.8rem', color: '#64748B', textAlign: 'center', margin: '0 0 18px' }}>
          No long video needed — start with just one idea.
        </p>

        {/* Surprise Me */}
        <button
          type="button"
          onClick={surprise}
          style={{
            display: 'block', width: '100%', maxWidth: 380, margin: '0 auto 12px',
            padding: '14px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, #22D3EE, #3B82F6)',
            color: '#05070D', fontWeight: 900, fontSize: '1.02rem', border: 'none', cursor: 'pointer',
          }}
        >
          🎲 Surprise Me — generate the hottest idea
        </button>

        {/* Type your own idea */}
        <div style={{ display: 'flex', gap: 8, maxWidth: 520, margin: '0 auto 24px' }}>
          <input
            type="text"
            value={customIdea}
            onChange={(e) => onCustomType(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') generateCustom() }}
            placeholder="Or type your own idea…"
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
            Generate
          </button>
        </div>

        {/* Rich starter cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {STARTERS.map((s) => {
            const vertColor = VERTICAL_COLORS[s.vertical] ?? '#6366f1'
            const badge = BADGE_STYLES[s.badge]
            return (
              <div
                key={s.title}
                style={{
                  background: 'var(--card, #0B1120)', border: '1px solid var(--border, rgba(255,255,255,0.10))',
                  borderRadius: 14, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 8,
                  transition: 'border-color 0.2s, transform 0.15s',
                }}
                onMouseEnter={(e) => { ;(e.currentTarget as HTMLDivElement).style.borderColor = vertColor; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border, rgba(255,255,255,0.10))'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: vertColor + '22', color: vertColor, whiteSpace: 'nowrap' }}>{s.label}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af' }}>🔥 {s.score}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{s.badge}</span>
                </div>

                <p style={{ margin: 0, fontSize: '1.02rem', fontWeight: 900, lineHeight: 1.25, color: '#F1F5F9', letterSpacing: '-0.01em' }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: '#9ca3af', lineHeight: 1.45 }}>{s.hook}</p>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B' }}>
                  <span style={{ color: '#94A3B8' }}>Why it works:</span> {s.why} · <span style={{ color: '#94A3B8' }}>60s · Faceless · Fast</span>
                </p>

                <button
                  type="button"
                  onClick={() => generate(s)}
                  style={{
                    marginTop: 'auto', padding: '11px 0', width: '100%', borderRadius: 9, border: 'none',
                    background: `linear-gradient(90deg, ${vertColor}, #ef4444)`, color: '#fff',
                    fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                >
                  Generate Free Short →
                </button>
              </div>
            )
          })}
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
