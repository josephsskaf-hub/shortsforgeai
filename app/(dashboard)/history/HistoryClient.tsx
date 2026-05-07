'use client'

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

const NICHE_META: Record<string, { emoji: string; name: string }> = {
  mideast: { emoji: '🔥', name: 'Middle East Secrets' },
  money: { emoji: '💰', name: 'Money Facts' },
  mind: { emoji: '🧠', name: 'Mind Blowing Facts' },
  dark: { emoji: '😱', name: 'Dark Mysteries' },
  motivation: { emoji: '🏋', name: 'Motivation' },
  ancient: { emoji: '🏛️', name: 'Ancient Civilizations' },
  space: { emoji: '🚀', name: 'Space Mysteries' },
  truecrime: { emoji: '🔍', name: 'True Crime' },
  conspiracy: { emoji: '👁️', name: 'Conspiracy Theories' },
  psychology: { emoji: '🧬', name: 'Psychology Facts' },
  nature: { emoji: '🌿', name: 'Nature & Wildlife' },
  tech: { emoji: '💻', name: 'Tech & AI Facts' },
  war: { emoji: '⚔️', name: 'War & Battles' },
  wealth: { emoji: '💎', name: 'Wealth & Luxury' },
  food: { emoji: '🍜', name: 'Food Secrets' },
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

  const usedNiches = useMemo(() => [...new Set(generations.map((g) => g.niche))], [generations])

  const filtered = useMemo(
    () => (filterNiche === 'all' ? generations : generations.filter((g) => g.niche === filterNiche)),
    [generations, filterNiche]
  )

  async function handleDelete(id: string) {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id)
      setTimeout(() => setDeleteConfirm(null), 3000)
      return
    }
    setDeleting(id)
    setDeleteConfirm(null)
    try {
      await supabase.from('generations').delete().eq('id', id)
      setGenerations((prev) => prev.filter((g) => g.id !== id))
      if (expanded === id) setExpanded(null)
    } finally {
      setDeleting(null)
    }
  }

  function handleGenerateAgain(niche: string) {
    router.push(`/dashboard?niche=${niche}`)
  }

  if (generations.length === 0) {
    return (
      <div className="px-6 py-7">
        <div className="mb-7">
          <div className="font-black uppercase tracking-widest mb-1" style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}>
            Generation History
          </div>
          <h1 className="font-black tracking-tight" style={{ fontSize: '1.45rem', color: 'var(--text)' }}>
            Your <span className="grad-text">History</span>
          </h1>
        </div>
        <div className="rounded-2xl p-16 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>Your next viral Short starts here.</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Head to Creator Hub and generate your first viral Shorts pack!</p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 mt-6 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', boxShadow: '0 4px 22px rgba(99,102,241,.3)', textDecoration: 'none' }}
          >
            ⚡ Generate Your First Pack
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-7 pb-20">
      {/* Header */}
      <div className="mb-6">
        <div className="font-black uppercase tracking-widest mb-1" style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}>
          Generation History
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-black tracking-tight mb-1" style={{ fontSize: '1.45rem', color: 'var(--text)' }}>
              Your <span className="grad-text">History</span>
            </h1>
            <p style={{ fontSize: '0.77rem', color: 'var(--muted)' }}>
              {filtered.length} generation{filtered.length !== 1 ? 's' : ''} · {filtered.reduce((a, g) => a + (g.content?.length ?? 0), 0)} scripts total
            </p>
          </div>
          <a
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', textDecoration: 'none' }}
          >
            ⚡ New Pack
          </a>
        </div>
      </div>

      {/* Niche filter pills */}
      {usedNiches.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <button
            onClick={() => setFilterNiche('all')}
            className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{
              background: filterNiche === 'all' ? 'rgba(99,102,241,.18)' : 'rgba(255,255,255,.04)',
              border: filterNiche === 'all' ? '1px solid rgba(99,102,241,.4)' : '1px solid var(--border)',
              color: filterNiche === 'all' ? 'var(--indigo-light)' : 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            All ({generations.length})
          </button>
          {usedNiches.map((niche) => {
            const meta = NICHE_META[niche] ?? { emoji: '⚡', name: niche }
            const count = generations.filter((g) => g.niche === niche).length
            return (
              <button
                key={niche}
                onClick={() => setFilterNiche(niche)}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{
                  background: filterNiche === niche ? 'rgba(99,102,241,.18)' : 'rgba(255,255,255,.04)',
                  border: filterNiche === niche ? '1px solid rgba(99,102,241,.4)' : '1px solid var(--border)',
                  color: filterNiche === niche ? 'var(--indigo-light)' : 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                {meta.emoji} {meta.name} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* List */}
      <div className="flex flex-col gap-3">
        {filtered.map((gen) => {
          const meta = NICHE_META[gen.niche] ?? { emoji: '⚡', name: gen.niche }
          const isOpen = expanded === gen.id
          const isDeleting = deleting === gen.id
          const wantsConfirm = deleteConfirm === gen.id

          return (
            <div
              key={gen.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'var(--card)',
                border: isOpen ? '1px solid rgba(99,102,241,.3)' : '1px solid var(--border)',
                boxShadow: isOpen ? '0 4px 28px rgba(99,102,241,.08)' : 'none',
                opacity: isDeleting ? 0.5 : 1,
                transition: 'opacity .3s, border .2s, box-shadow .2s',
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
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.14), rgba(124,58,237,.09))', border: '1px solid rgba(99,102,241,.18)' }}
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

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleGenerateAgain(gen.niche)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: 'rgba(99,102,241,.08)',
                      border: '1px solid rgba(99,102,241,.18)',
                      color: 'var(--indigo-light)',
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
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all"
                    style={{
                      background: wantsConfirm ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.04)',
                      border: wantsConfirm ? '1px solid rgba(239,68,68,.4)' : '1px solid var(--border)',
                      color: wantsConfirm ? '#f87171' : 'var(--muted)',
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isDeleting ? '…' : wantsConfirm ? '✓?' : '🗑'}
                  </button>

                  <button
                    onClick={() => setExpanded(isOpen ? null : gen.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all"
                    style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
                  >
                    {isOpen ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {/* Expanded scripts */}
              {isOpen && (
                <div
                  className="px-4 pb-4 flex flex-col gap-4 animate-fade-in"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <div className="pt-4">
                    {(gen.content ?? []).map((video, i) => (
                      <div key={i} className="mb-4 last:mb-0">
                        <ResultCard video={video} index={i} />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleGenerateAgain(gen.niche)}
                    className="w-full rounded-xl py-3 text-sm font-black text-white transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 22px rgba(99,102,241,.3)',
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

      {filtered.length === 0 && filterNiche !== 'all' && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No generations for this niche yet.</p>
          <button
            onClick={() => setFilterNiche('all')}
            className="mt-3 text-xs font-bold"
            style={{ color: 'var(--indigo-light)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Show all →
          </button>
        </div>
      )}
    </div>
  )
}
