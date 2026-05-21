'use client'

// Push #080 — History v2: homepage-quality UI, stats banner, glow cards, polished filter pills

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

const NICHE_META: Record<string, { emoji: string; name: string; accent: string }> = {
  mideast:     { emoji: '🔥', name: 'Middle East Secrets',    accent: '#EF4444' },
  money:       { emoji: '💰', name: 'Money Facts',            accent: '#22D3EE' },
  mind:        { emoji: '🧠', name: 'Mind Blowing Facts',     accent: '#8B5CF6' },
  dark:        { emoji: '😱', name: 'Dark Mysteries',         accent: '#EC4899' },
  motivation:  { emoji: '🏋', name: 'Motivation',             accent: '#F59E0B' },
  ancient:     { emoji: '🏛️', name: 'Ancient Civilizations',  accent: '#10B981' },
  space:       { emoji: '🚀', name: 'Space Mysteries',        accent: '#6366F1' },
  truecrime:   { emoji: '🔍', name: 'True Crime',             accent: '#EF4444' },
  conspiracy:  { emoji: '👁️', name: 'Conspiracy Theories',    accent: '#8B5CF6' },
  psychology:  { emoji: '🧬', name: 'Psychology Facts',       accent: '#EC4899' },
  nature:      { emoji: '🌿', name: 'Nature & Wildlife',      accent: '#10B981' },
  tech:        { emoji: '💻', name: 'Tech & AI Facts',        accent: '#3B82F6' },
  war:         { emoji: '⚔️', name: 'War & Battles',          accent: '#EF4444' },
  wealth:      { emoji: '💎', name: 'Wealth & Luxury',        accent: '#22D3EE' },
  food:        { emoji: '🍜', name: 'Food Secrets',           accent: '#F59E0B' },
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function HistoryClient({ generations: initialGenerations }: HistoryClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [generations, setGenerations] = useState(initialGenerations)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterNiche, setFilterNiche] = useState<string>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const usedNiches = useMemo(() => [...new Set(generations.map((g) => g.niche))], [generations])

  const filtered = useMemo(
    () => (filterNiche === 'all' ? generations : generations.filter((g) => g.niche === filterNiche)),
    [generations, filterNiche]
  )

  const totalScripts = useMemo(
    () => generations.reduce((a, g) => a + (g.content?.length ?? 0), 0),
    [generations]
  )

  async function handleDelete(id: string) {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id)
      setDeleteError(null)
      setTimeout(() => setDeleteConfirm(null), 3000)
      return
    }
    setDeleting(id)
    setDeleteConfirm(null)
    setDeleteError(null)
    try {
      const { error } = await supabase.from('generations').delete().eq('id', id)
      if (error) {
        console.error('[history] delete failed:', error.message)
        setDeleteError('Could not delete that pack. Please retry.')
        return
      }
      setGenerations((prev) => prev.filter((g) => g.id !== id))
      if (expanded === id) setExpanded(null)
    } finally {
      setDeleting(null)
    }
  }

  function handleGenerateAgain(niche: string) {
    router.push(`/dashboard?niche=${niche}`)
  }

  /* ── Empty state ── */
  if (generations.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-7">
        <header className="mb-7">
          <div
            className="font-black uppercase tracking-[.18em] mb-2 flex items-center gap-2"
            style={{ fontSize: '0.65rem', color: '#22D3EE' }}
          >
            <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
            Generation History
            <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
          </div>
          <h1
            className="font-black tracking-tight"
            style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}
          >
            Your{' '}
            <span style={{ background: 'linear-gradient(135deg,#22D3EE,#3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              History
            </span>
          </h1>
        </header>

        <div
          className="rounded-2xl p-10 sm:p-16 text-center"
          style={{
            background: 'rgba(11,17,32,0.85)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
          }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg, rgba(34,211,238,.12), rgba(59,130,246,.08))', border: '1px solid rgba(34,211,238,.2)' }}
          >
            📋
          </div>
          <h2
            className="text-xl font-black mb-2"
            style={{ color: 'var(--text)' }}
          >
            Your next viral Short starts here.
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Head to Creator Hub and generate your first viral Shorts pack!
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #2563EB, #22D3EE)',
              boxShadow: '0 6px 28px rgba(59,130,246,.4)',
              textDecoration: 'none',
              transition: 'all 0.18s ease',
            }}
          >
            ⚡ Generate Your First Pack
          </a>
        </div>
      </div>
    )
  }

  /* ── Main ── */
  return (
    <div className="px-4 md:px-6 py-7 pb-20">
      <style>{`
        .hist-card {
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .hist-pill {
          transition: all 0.15s ease;
        }
        .hist-pill:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .hist-again-btn {
          transition: all 0.15s ease;
        }
        .hist-again-btn:hover {
          background: rgba(59,130,246,.18) !important;
          transform: translateY(-1px);
        }
      `}</style>

      {/* ── Header ── */}
      <div className="mb-6">
        <div
          className="font-black uppercase tracking-[.18em] mb-2 flex items-center gap-2"
          style={{ fontSize: '0.65rem', color: '#22D3EE' }}
        >
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
          Generation History
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
        </div>

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1
              className="font-black tracking-tight mb-1"
              style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}
            >
              Your{' '}
              <span style={{ background: 'linear-gradient(135deg,#22D3EE,#3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                History
              </span>
            </h1>
          </div>
          <a
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #2563EB, #22D3EE)',
              textDecoration: 'none',
              boxShadow: '0 4px 18px rgba(59,130,246,.35)',
              transition: 'all 0.18s ease',
            }}
          >
            ⚡ New Pack
          </a>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div
        className="flex items-center gap-px mb-6 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(11,17,32,0.8)',
          border: '1px solid rgba(255,255,255,0.07)',
          display: 'inline-flex',
        }}
      >
        {[
          { val: String(generations.length), label: 'Generations' },
          { val: String(totalScripts), label: 'Scripts' },
          { val: String(usedNiches.length), label: 'Niches' },
        ].map((s, i) => (
          <div
            key={s.label}
            className="flex flex-col items-center px-5 py-2.5"
            style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
          >
            <span
              className="font-black text-lg leading-none"
              style={{
                background: 'linear-gradient(135deg,#22D3EE,#3B82F6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {s.val}
            </span>
            <span style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: 2 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Niche filter pills ── */}
      {usedNiches.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <button
            onClick={() => setFilterNiche('all')}
            className="hist-pill px-3.5 py-1.5 rounded-full text-xs font-bold"
            style={{
              background: filterNiche === 'all' ? 'rgba(34,211,238,.15)' : 'rgba(255,255,255,.04)',
              border: filterNiche === 'all' ? '1px solid rgba(34,211,238,.4)' : '1px solid rgba(255,255,255,.08)',
              color: filterNiche === 'all' ? '#22D3EE' : 'var(--muted)',
              cursor: 'pointer',
              boxShadow: filterNiche === 'all' ? '0 0 16px rgba(34,211,238,.15)' : 'none',
            }}
          >
            All ({generations.length})
          </button>
          {usedNiches.map((niche) => {
            const meta = NICHE_META[niche] ?? { emoji: '⚡', name: niche, accent: '#3B82F6' }
            const count = generations.filter((g) => g.niche === niche).length
            const active = filterNiche === niche
            return (
              <button
                key={niche}
                onClick={() => setFilterNiche(niche)}
                className="hist-pill px-3.5 py-1.5 rounded-full text-xs font-bold"
                style={{
                  background: active ? `${meta.accent}18` : 'rgba(255,255,255,.04)',
                  border: active ? `1px solid ${meta.accent}50` : '1px solid rgba(255,255,255,.08)',
                  color: active ? meta.accent : 'var(--muted)',
                  cursor: 'pointer',
                  boxShadow: active ? `0 0 16px ${meta.accent}20` : 'none',
                }}
              >
                {meta.emoji} {meta.name} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* ── Error alert ── */}
      {deleteError && (
        <div
          role="alert"
          className="rounded-xl px-4 py-3 text-sm mb-4"
          style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171' }}
        >
          {deleteError}
        </div>
      )}

      {/* ── List ── */}
      <div className="flex flex-col gap-3">
        {filtered.map((gen) => {
          const meta = NICHE_META[gen.niche] ?? { emoji: '⚡', name: gen.niche, accent: '#3B82F6' }
          const isOpen = expanded === gen.id
          const isDeleting = deleting === gen.id
          const wantsConfirm = deleteConfirm === gen.id

          return (
            <div
              key={gen.id}
              className="hist-card rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(11,17,32,0.85)',
                border: isOpen
                  ? `1px solid ${meta.accent}40`
                  : '1px solid rgba(255,255,255,0.07)',
                boxShadow: isOpen ? `0 6px 36px ${meta.accent}15` : '0 2px 12px rgba(0,0,0,.2)',
                opacity: isDeleting ? 0.5 : 1,
                transition: 'opacity .3s, border .2s, box-shadow .2s',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <button
                  onClick={() => setExpanded(isOpen ? null : gen.id)}
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${meta.accent}20, ${meta.accent}0a)`,
                      border: `1px solid ${meta.accent}30`,
                    }}
                  >
                    {meta.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>{meta.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {formatDate(gen.created_at)} · {gen.content?.length ?? 0} scripts
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleGenerateAgain(gen.niche)}
                    className="hist-again-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                    style={{
                      background: 'rgba(59,130,246,.08)',
                      border: '1px solid rgba(59,130,246,.18)',
                      color: '#60A5FA',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ⚡ Again
                  </button>

                  <button
                    onClick={() => handleDelete(gen.id)}
                    disabled={isDeleting}
                    title={wantsConfirm ? 'Click again to confirm' : 'Delete'}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                    style={{
                      background: wantsConfirm ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.04)',
                      border: wantsConfirm ? '1px solid rgba(239,68,68,.4)' : '1px solid rgba(255,255,255,.08)',
                      color: wantsConfirm ? '#f87171' : 'var(--muted)',
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isDeleting ? '…' : wantsConfirm ? '✓?' : '🗑'}
                  </button>

                  <button
                    onClick={() => setExpanded(isOpen ? null : gen.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                    style={{
                      background: 'rgba(255,255,255,.04)',
                      border: '1px solid rgba(255,255,255,.08)',
                      color: isOpen ? '#22D3EE' : 'var(--muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isOpen ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {/* Expanded scripts */}
              {isOpen && (
                <div
                  className="px-4 pb-4 flex flex-col gap-4"
                  style={{ borderTop: `1px solid ${meta.accent}22` }}
                >
                  <div className="pt-4">
                    {(gen.content ?? []).map((video, i) => (
                      <div key={i} className="mb-4 last:mb-0">
                        <ResultCard video={video} index={i} niche={gen.niche} />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleGenerateAgain(gen.niche)}
                    className="w-full rounded-xl py-3 text-sm font-black text-white"
                    style={{
                      background: 'linear-gradient(135deg, #2563EB 0%, #22D3EE 100%)',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 6px 28px rgba(59,130,246,.35)',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    ⚡ Generate New {meta.name} Pack →
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty filter result */}
      {filtered.length === 0 && filterNiche !== 'all' && (
        <div className="text-center py-14">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No generations for this niche yet.</p>
          <button
            onClick={() => setFilterNiche('all')}
            className="mt-3 text-xs font-bold"
            style={{ color: '#22D3EE', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Show all →
          </button>
        </div>
      )}
    </div>
  )
}
