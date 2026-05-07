'use client'

import { useState } from 'react'
import ResultCard from '@/components/ResultCard'
import { ShortVideo } from '@/lib/openai'

interface Generation {
  id: string
  niche: string
  content: ShortVideo[]
  created_at: string
}

interface HistoryClientProps {
  generations: Generation[]
}

const NICHE_META: Record<string, { emoji: string; name: string }> = {
  mideast: { emoji: '🔥', name: 'Middle East Secrets' },
  money: { emoji: '💰', name: 'Money Facts' },
  mind: { emoji: '🧠', name: 'Mind Blowing Facts' },
  dark: { emoji: '😱', name: 'Dark Mysteries' },
  motivation: { emoji: '🏋', name: 'Motivation' },
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HistoryClient({ generations }: HistoryClientProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (generations.length === 0) {
    return (
      <div className="px-6 py-7">
        <div className="mb-7">
          <div
            className="font-black uppercase tracking-widest mb-1"
            style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}
          >
            Generation History
          </div>
          <h1
            className="font-black tracking-tight"
            style={{ fontSize: '1.45rem', color: 'var(--text)' }}
          >
            Your <span className="grad-text">History</span>
          </h1>
        </div>

        <div
          className="rounded-2xl p-16 text-center"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>
            Your next viral Short starts here.
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Head to Creator Hub and generate your first viral Shorts pack!
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 mt-6 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
              boxShadow: '0 4px 22px rgba(99,102,241,.3)',
              textDecoration: 'none',
            }}
          >
            ⚡ Generate New Short
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-7 pb-20">
      {/* Header */}
      <div className="mb-7">
        <div
          className="font-black uppercase tracking-widest mb-1"
          style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}
        >
          Generation History
        </div>
        <h1
          className="font-black tracking-tight mb-1"
          style={{ fontSize: '1.45rem', color: 'var(--text)' }}
        >
          Your <span className="grad-text">History</span>
        </h1>
        <p style={{ fontSize: '0.77rem', color: 'var(--muted)' }}>
          {generations.length} generation{generations.length !== 1 ? 's' : ''} — click any entry to expand
        </p>
      </div>

      {/* List */}
      <div className="flex flex-col gap-4">
        {generations.map((gen) => {
          const meta = NICHE_META[gen.niche] ?? { emoji: '⚡', name: gen.niche }
          const isOpen = expanded === gen.id

          return (
            <div
              key={gen.id}
              className="rounded-2xl overflow-hidden transition-all"
              style={{
                background: 'var(--card)',
                border: isOpen ? '1px solid rgba(99,102,241,.3)' : '1px solid var(--border)',
                boxShadow: isOpen ? '0 4px 28px rgba(99,102,241,.08)' : 'none',
              }}
            >
              {/* Header row */}
              <button
                onClick={() => setExpanded(isOpen ? null : gen.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,.14), rgba(124,58,237,.09))',
                    border: '1px solid rgba(99,102,241,.18)',
                  }}
                >
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-bold text-sm"
                    style={{ color: 'var(--text)' }}
                  >
                    {meta.name}
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--muted)' }}
                  >
                    {formatDate(gen.created_at)} · {gen.content?.length ?? 0} scripts
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 flex-shrink-0"
                >
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-md"
                    style={{
                      background: 'rgba(99,102,241,.09)',
                      border: '1px solid rgba(99,102,241,.14)',
                      color: 'var(--indigo-light)',
                    }}
                  >
                    5 shorts
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div
                  className="px-5 pb-5 flex flex-col gap-4 animate-fade-in"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <div className="pt-4">
                    {(gen.content ?? []).map((video, i) => (
                      <div key={i} className="mb-4 last:mb-0">
                        <ResultCard video={video} index={i} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
