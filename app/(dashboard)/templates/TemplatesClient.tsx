'use client'

// Push #080 — Templates v2: homepage-quality UI, hover glow, category badges, stats row

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Template {
  emoji: string
  title: string
  description: string
  prompt: string
  category: string
  accent: string
}

const TEMPLATES: Template[] = [
  {
    emoji: '🛸',
    title: 'Space Mystery',
    description: "Uncover the universe's darkest secrets — black holes, alien signals, missing planets.",
    prompt: 'Create a Space Mystery Short about [topic]',
    category: 'Science',
    accent: '#8B5CF6',
  },
  {
    emoji: '📜',
    title: 'History Facts',
    description: 'Forgotten moments that changed the world. The events no textbook ever taught.',
    prompt: 'Create a History Facts Short about [topic]',
    category: 'Education',
    accent: '#F59E0B',
  },
  {
    emoji: '🌍',
    title: 'Hidden Places',
    description: 'Locations most people will never visit. Forbidden zones and lost civilizations.',
    prompt: 'Create a Hidden Places Short about [topic]',
    category: 'Travel',
    accent: '#8B5CF6',
  },
  {
    emoji: '🕵️',
    title: 'Cold Cases',
    description: 'Unsolved mysteries that still haunt investigators. Dark truths left unanswered.',
    prompt: 'Create a Cold Cases Short about [topic]',
    category: 'Crime',
    accent: '#EF4444',
  },
  {
    emoji: '🦑',
    title: 'Weird Animals',
    description: "Nature's strangest creatures. Predators and survivors that defy all logic.",
    prompt: 'Create a Weird Animals Short about [topic]',
    category: 'Nature',
    accent: '#06B6D4',
  },
  {
    emoji: '💰',
    title: 'Money Psychology',
    description: 'How your brain sabotages your finances — and the mental shifts that fix it.',
    prompt: 'Create a Money Psychology Short about [topic]',
    category: 'Finance',
    accent: '#22D3EE',
  },
  {
    emoji: '🤖',
    title: 'AI Tools',
    description: 'The tools reshaping how people work, earn, and create. The future is here.',
    prompt: 'Create an AI Tools Short about [topic]',
    category: 'Tech',
    accent: '#8B5CF6',
  },
  {
    emoji: '🧠',
    title: 'Dark Psychology',
    description: 'The mental patterns that control behavior. Manipulation, influence, and power.',
    prompt: 'Create a Dark Psychology Short about [topic]',
    category: 'Psychology',
    accent: '#EC4899',
  },
]

export default function TemplatesClient() {
  const router = useRouter()
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  function useTemplate(prompt: string) {
    router.push(`/generate?prompt=${encodeURIComponent(prompt)}`)
  }

  return (
    <div className="px-4 sm:px-6 py-7 pb-20 max-w-6xl mx-auto">
      <style>{`
        .tmpl-card {
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease;
        }
        .tmpl-card:hover {
          transform: translateY(-4px);
        }
        .tmpl-btn {
          transition: all 0.18s ease;
        }
        .tmpl-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.12);
          box-shadow: 0 8px 32px rgba(139,92,246,.5) !important;
        }
        .tmpl-emoji-box {
          transition: box-shadow 0.22s ease, transform 0.22s ease;
        }
        .tmpl-card:hover .tmpl-emoji-box {
          transform: scale(1.06);
        }
      `}</style>

      {/* ── Header ── */}
      <header className="mb-9">
        <div
          className="font-black uppercase tracking-[.18em] mb-3 flex items-center gap-2"
          style={{ fontSize: '0.65rem', color: '#22D3EE' }}
        >
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
          Templates
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
        </div>

        <h1
          className="font-black tracking-tight mb-3"
          style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', color: 'var(--text)', lineHeight: 1.08 }}
        >
          Start from a{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #22D3EE 0%, #8B5CF6 60%, #8B5CF6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            proven format
          </span>
          .
        </h1>

        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.65, maxWidth: 520 }}>
          Each template is calibrated for virality — the AI fills in the hook, scenes, captions and
          voiceover automatically.
        </p>

        {/* Stats strip */}
        <div
          className="flex items-center gap-px mt-6 rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(11,17,32,0.8)',
            border: '1px solid rgba(255,255,255,0.07)',
            display: 'inline-flex',
          }}
        >
          {[
            { val: '8', label: 'Templates' },
            { val: '8', label: 'Categories' },
            { val: '35s', label: 'Avg. length' },
          ].map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center px-6 py-3"
              style={{
                borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <span
                className="font-black text-lg leading-none"
                style={{
                  background: 'linear-gradient(135deg, #22D3EE, #8B5CF6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {s.val}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 2 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </header>

      {/* ── Grid ── */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(275px, 1fr))' }}
      >
        {TEMPLATES.map((t, idx) => {
          const isHovered = hoveredIdx === idx
          return (
            <div
              key={t.title}
              className="tmpl-card rounded-2xl p-6 flex flex-col"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                background: 'rgba(11,17,32,0.85)',
                border: isHovered
                  ? `1px solid ${t.accent}55`
                  : '1px solid rgba(255,255,255,0.07)',
                boxShadow: isHovered
                  ? `0 12px 48px ${t.accent}25, 0 2px 0 ${t.accent}18 inset`
                  : '0 2px 12px rgba(0,0,0,0.25)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Top row: emoji + category badge */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className="tmpl-emoji-box w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${t.accent}25, ${t.accent}0d)`,
                    border: `1px solid ${t.accent}35`,
                    boxShadow: isHovered ? `0 0 22px ${t.accent}35` : 'none',
                  }}
                >
                  {t.emoji}
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: `${t.accent}18`,
                    border: `1px solid ${t.accent}28`,
                    color: t.accent,
                    fontSize: '0.63rem',
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t.category}
                </span>
              </div>

              {/* Title */}
              <h2
                className="font-black tracking-tight mb-2"
                style={{ fontSize: '1.05rem', color: 'var(--text)', lineHeight: 1.2 }}
              >
                {t.title}
              </h2>

              {/* Description */}
              <p
                className="flex-1 mb-5"
                style={{ color: 'var(--muted2)', lineHeight: 1.6, fontSize: '0.82rem' }}
              >
                {t.description}
              </p>

              {/* CTA */}
              <button
                type="button"
                onClick={() => useTemplate(t.prompt)}
                className="tmpl-btn rounded-xl py-2.5 text-sm font-black mt-auto"
                style={{
                  background: `linear-gradient(135deg, ${t.accent}ee, ${t.accent}99)`,
                  color: '#FFFFFF',
                  boxShadow: `0 4px 20px ${t.accent}35`,
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                Use Template →
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <p
        className="text-center mt-8"
        style={{ fontSize: '0.75rem', color: 'var(--muted)', opacity: 0.55 }}
      >
        New templates added regularly · Suggest one at{' '}
        <span style={{ color: '#22D3EE' }}>support@shortsforgeai.com</span>
      </p>
    </div>
  )
}
