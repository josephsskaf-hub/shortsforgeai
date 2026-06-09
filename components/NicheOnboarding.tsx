'use client'

// #467 — Onboarding niche picker (Measure 2 / P0). Shown to brand-new users on
// /generate so they never face a blank box: pick a niche → pick a ready example
// → "Create my first Short" (Fast engine, zero friction) — OR "Surprise Me".
// Goal: lift first-video activation (21% → 40%+). Fires the onboarding funnel
// events. Self-contained; the parent wires onPick/onSurprise/onClose.
import { useEffect, useState } from 'react'

type Props = {
  onPick: (topic: string, niche: string) => void
  onSurprise: (topic: string) => void
  onClose: () => void
}

const NICHES: { key: string; label: string; emoji: string; prompts: string[] }[] = [
  { key: 'mystery', label: 'Mystery / Hidden Facts', emoji: '🕵️', prompts: [
    'The island where snakes rule everything',
    'The ocean mystery scientists still can’t explain',
    'The strange signal NASA detected in deep space',
  ] },
  { key: 'money', label: 'Money / Business', emoji: '💰', prompts: [
    'Why rich people think differently about money',
    'The morning habit that built billion-dollar fortunes',
    'How compound interest quietly makes millionaires',
  ] },
  { key: 'ai', label: 'AI / Future Tech', emoji: '🤖', prompts: [
    'The AI breakthrough that shocked scientists',
    '5 jobs AI will change forever',
    'The robot that learned to do the impossible',
  ] },
  { key: 'history', label: 'History', emoji: '🏛️', prompts: [
    'The Roman city frozen in time by a volcano',
    'The colony that vanished overnight, leaving one word',
    '5 history facts that sound fake but are real',
  ] },
  { key: 'health', label: 'Health / Psychology', emoji: '🧠', prompts: [
    'One habit before sleep that doubles your focus',
    'The psychology trick that rewires your brain',
    'Why your brain craves dopamine — and how to reset it',
  ] },
  { key: 'sports', label: 'Sports', emoji: '⚽', prompts: [
    'The most insane comeback in sports history',
    'The athlete who defied science',
    '5 records nobody thought would ever break',
  ] },
  { key: 'reddit', label: 'Reddit-style Story', emoji: '📖', prompts: [
    'The neighbor who watched the house for years',
    'A creepy text that turned out to be real',
    'The roommate secret that changed everything',
  ] },
  { key: 'affiliate', label: 'Affiliate Product Video', emoji: '🛒', prompts: [
    'This $20 gadget went viral for a reason',
    '3 tools every faceless creator secretly uses',
    'The app that saves you 5 hours every week',
  ] },
]

const SURPRISE_POOL = NICHES.flatMap((n) => n.prompts)

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

export default function NicheOnboarding({ onPick, onSurprise, onClose }: Props) {
  const [openNiche, setOpenNiche] = useState<string | null>(null)
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null)

  useEffect(() => {
    track('onboarding_viewed')
  }, [])

  const active = NICHES.find((n) => n.key === openNiche) || null

  function selectNiche(key: string) {
    setOpenNiche(key)
    setSelectedPrompt(null)
    track('onboarding_niche_selected', { niche: key })
  }

  function create() {
    const topic = selectedPrompt || active?.prompts[0]
    if (!topic || !active) return
    track('first_video_started', { niche: active.key, source: 'onboarding' })
    onPick(topic, active.key)
  }

  function surprise() {
    const topic = SURPRISE_POOL[Math.floor(Math.random() * SURPRISE_POOL.length)]
    track('surprise_me_clicked', { topic })
    track('first_video_started', { source: 'surprise_me' })
    onSurprise(topic)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose what kind of Short to create"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(5,7,13,0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '32px 16px 48px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#F1F5F9', textAlign: 'center', margin: '0 0 6px', lineHeight: 1.2 }}>
          What kind of Short do you want to create?
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#94A3B8', textAlign: 'center', margin: '0 0 18px' }}>
          Pick one — your first Short is free and takes ~60 seconds.
        </p>

        {/* Surprise Me — fastest path */}
        <button
          type="button"
          onClick={surprise}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 340,
            margin: '0 auto 22px',
            padding: '12px 18px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #22D3EE, #3B82F6)',
            color: '#05070D',
            fontWeight: 900,
            fontSize: '1rem',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          🎲 Surprise Me — just make one
        </button>

        {/* Niche grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {NICHES.map((n) => {
            const isOpen = openNiche === n.key
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => selectNiche(n.key)}
                style={{
                  textAlign: 'left',
                  padding: '14px 14px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: isOpen ? 'rgba(34,211,238,0.10)' : 'rgba(255,255,255,0.04)',
                  border: isOpen ? '1.5px solid rgba(34,211,238,0.6)' : '1px solid rgba(255,255,255,0.10)',
                  color: '#F1F5F9',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: 4 }}>{n.emoji}</span>
                {n.label}
              </button>
            )
          })}
        </div>

        {/* Example prompts for the selected niche */}
        {active && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Pick an idea ({active.label})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {active.prompts.map((p) => {
                const sel = selectedPrompt === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPrompt(p)}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: sel ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.03)',
                      border: sel ? '1.5px solid rgba(52,211,153,0.6)' : '1px solid rgba(255,255,255,0.10)',
                      color: sel ? '#fff' : '#CBD5E1',
                      fontWeight: 600,
                      fontSize: '0.92rem',
                    }}
                  >
                    {sel ? '✓ ' : ''}{p}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={create}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 16,
                padding: '15px 18px',
                borderRadius: 14,
                background: '#22D3EE',
                color: '#05070D',
                fontWeight: 900,
                fontSize: '1.05rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Create my first Short →
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'block',
            margin: '20px auto 0',
            background: 'transparent',
            border: 'none',
            color: '#64748B',
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Skip — I&apos;ll type my own idea
        </button>
      </div>
    </div>
  )
}
