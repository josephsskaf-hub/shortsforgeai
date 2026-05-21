'use client'

// Push #071 — Templates gallery.
// 8 curated viral formats. Each card drops its prompt into /generate via
// the ?prompt= query param so the user lands on Step 1 with the brief
// already filled in.

import { useRouter } from 'next/navigation'

interface Template {
  emoji: string
  title: string
  description: string
  prompt: string
}

const TEMPLATES: Template[] = [
  {
    emoji: '🛸',
    title: 'Space Mystery',
    description: "Uncover the universe's darkest secrets.",
    prompt: 'Create a Space Mystery Short about [topic]',
  },
  {
    emoji: '📜',
    title: 'History Facts',
    description: 'Forgotten moments that changed the world.',
    prompt: 'Create a History Facts Short about [topic]',
  },
  {
    emoji: '🌍',
    title: 'Hidden Places',
    description: 'Locations most people will never visit.',
    prompt: 'Create a Hidden Places Short about [topic]',
  },
  {
    emoji: '🕵️',
    title: 'Cold Cases',
    description: 'Unsolved mysteries that still haunt us.',
    prompt: 'Create a Cold Cases Short about [topic]',
  },
  {
    emoji: '🦑',
    title: 'Weird Animals',
    description: "Nature's strangest creatures.",
    prompt: 'Create a Weird Animals Short about [topic]',
  },
  {
    emoji: '💰',
    title: 'Money Psychology',
    description: 'How your brain sabotages your finances.',
    prompt: 'Create a Money Psychology Short about [topic]',
  },
  {
    emoji: '🤖',
    title: 'AI Tools',
    description: 'The tools reshaping how people work.',
    prompt: 'Create an AI Tools Short about [topic]',
  },
  {
    emoji: '🧠',
    title: 'Dark Psychology',
    description: 'The mental patterns that control behavior.',
    prompt: 'Create a Dark Psychology Short about [topic]',
  },
]

export default function TemplatesClient() {
  const router = useRouter()

  function useTemplate(prompt: string) {
    router.push(`/generate?prompt=${encodeURIComponent(prompt)}`)
  }

  return (
    <div className="px-4 sm:px-6 py-7 pb-20 max-w-6xl mx-auto">
      <header className="mb-9 text-center">
        <div
          className="font-black uppercase tracking-[.16em] mb-2"
          style={{ fontSize: '0.68rem', color: '#3B82F6' }}
        >
          Templates
        </div>
        <h1
          className="font-black tracking-tight mb-2"
          style={{ fontSize: '1.85rem', color: 'var(--text)', lineHeight: 1.1 }}
        >
          Start from a{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #60A5FA, #3B82F6, #1D4ED8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            proven style
          </span>
          .
        </h1>
        <p className="text-sm max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
          Pick a template — the AI fills in the hook, scenes, captions and voiceover.
        </p>
      </header>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
      >
        {TEMPLATES.map((t) => (
          <div
            key={t.title}
            className="rounded-2xl p-6 flex flex-col"
            style={{
              background:
                'linear-gradient(180deg, rgba(18,18,30,.95), rgba(14,14,24,.95))',
              border: '1px solid #222',
              transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span style={{ fontSize: '1.7rem', lineHeight: 1 }}>{t.emoji}</span>
              <h2
                className="font-black tracking-tight"
                style={{ fontSize: '1.05rem', color: 'var(--text)' }}
              >
                {t.title}
              </h2>
            </div>
            <p
              className="text-sm flex-1 mb-5"
              style={{ color: 'var(--muted2)', lineHeight: 1.55 }}
            >
              {t.description}
            </p>
            <button
              type="button"
              onClick={() => useTemplate(t.prompt)}
              className="rounded-xl py-2.5 text-sm font-black mt-auto"
              style={{
                background: '#3B82F6',
                color: '#FFFFFF',
                boxShadow: '0 4px 22px rgba(59, 130, 246,.3)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Use Template →
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
