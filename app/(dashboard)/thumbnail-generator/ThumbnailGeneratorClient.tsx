'use client'

// Push #080 — ThumbnailGenerator v2: homepage-quality header, glow style cards, blue gradient CTA

import { useState, useRef, useCallback, useEffect } from 'react'

// KINEO-CHARLOCK-V2-2026-07-10 — saved characters (same face every image).
interface CharacterChip {
  id: string
  name: string
  image_url: string
}

// ─── Constants ─────────────────────────────────────────────────────────────
const FREE_DAILY_LIMIT = 2
const STORAGE_KEY = 'sfai_thumb_daily'

const STYLES = [
  { id: 'mrbeast',     label: 'MrBeast',      emoji: '🤯', desc: 'Extreme reaction, bold colors',       sample: 'Extreme challenge reveal, winner takes $100,000 prize' },
  { id: 'mystery',     label: 'Mystery/Dark',  emoji: '🌑', desc: 'Eerie, shadowy atmosphere',           sample: 'Ancient secret hidden for 3,000 years finally exposed' },
  { id: 'finance',     label: 'Finance',       emoji: '💰', desc: 'Professional, Wall Street',           sample: 'How billionaires hide their money from taxes revealed' },
  { id: 'documentary', label: 'Documentary',   emoji: '🎥', desc: 'Photojournalistic, authentic',        sample: 'The last untouched tribe on Earth discovered in 2024' },
  { id: 'viral-facts', label: 'Viral Facts',   emoji: '🤯', desc: 'Bold numbers, shocking stats',        sample: '99% of people do not know these shocking money facts' },
  { id: 'gaming',      label: 'Gaming',        emoji: '🎮', desc: 'Epic action, neon lighting',          sample: 'World record broken in 30 seconds, impossible speedrun' },
  { id: 'minimal',     label: 'Minimal',       emoji: '⬜', desc: 'Clean, elegant, premium',             sample: 'The simple habit that changed everything in 30 days' },
  { id: 'cinematic',   label: 'Cinematic',     emoji: '🎬', desc: 'Movie poster quality',                sample: 'The untold story that shook the entire world in 2024' },
]

// ─── Daily limit helpers (localStorage) ───────────────────────────────────
function getTodayKey() {
  return new Date().toISOString().slice(0, 10) // "2025-01-15"
}

function getDailyUsage(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw)
    if (parsed.date !== getTodayKey()) return 0
    return typeof parsed.count === 'number' ? parsed.count : 0
  } catch { return 0 }
}

function incrementDailyUsage(): number {
  if (typeof window === 'undefined') return 0
  const current = getDailyUsage()
  const next = current + 1
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), count: next }))
  return next
}

// ─── Sub-components ────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        animation: 'pulse 1.5s ease-in-out infinite',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
          animation: 'shimmer 2s infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>🖼️</div>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem', fontWeight: 600 }}>
          Generating thumbnail…
        </p>
      </div>
    </div>
  )
}

interface ThumbnailCardProps {
  url: string
  index: number
  selected: boolean
  onSelect: () => void
}

function ThumbnailCard({ url, index, selected, onSelect }: ThumbnailCardProps) {
  const [hovered, setHovered] = useState(false)

  async function handleDownload() {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `thumbnail-${index + 1}-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(url, '_blank')
    }
  }

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: 12,
        cursor: 'pointer',
        border: selected
          ? '2px solid #2997ff'
          : hovered
          ? '2px solid rgba(52, 211, 153,0.5)'
          : '2px solid rgba(255,255,255,0.08)',
        boxShadow: selected
          ? '0 0 32px rgba(16, 185, 129,0.45)'
          : hovered
          ? '0 0 20px rgba(16, 185, 129,0.2)'
          : 'none',
        transition: 'all 0.18s ease',
        overflow: 'hidden',
      }}
    >
      {/* Thumbnail image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Thumbnail variation ${index + 1}`}
        style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }}
      />

      {/* Overlay with actions */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: hovered
            ? 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.75) 100%)'
            : 'transparent',
          transition: 'background 0.2s ease',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '12px 14px',
        }}
      >
        {hovered && (
          <>
            <span
              style={{
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                color: '#2997ff',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid rgba(52, 211, 153,0.3)',
              }}
            >
              #{index + 1}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload() }}
              style={{
                background: 'linear-gradient(135deg, #2997ff, #2997ff)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(16, 185, 129,0.4)',
              }}
            >
              ⬇ Download
            </button>
          </>
        )}
      </div>

      {/* Selected indicator */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2997ff, #2997ff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.9rem',
            boxShadow: '0 0 12px rgba(16, 185, 129,0.5)',
          }}
        >
          ✓
        </div>
      )}
    </div>
  )
}

// YouTube feed preview mockup
function YouTubeFeedPreview({ url }: { url: string }) {
  return (
    <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 14, textTransform: 'uppercase' }}>
        📺 YouTube Feed Preview
      </p>
      {/* Fake YouTube UI */}
      <div style={{ background: '#161618', borderRadius: 10, padding: 16, maxWidth: 380 }}>
        {/* Thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="YouTube feed preview"
          style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8 }}
        />
        {/* Video info */}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          {/* Avatar */}
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #2997ff, #2997ff)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, background: 'rgba(255,255,255,0.12)', borderRadius: 4, marginBottom: 6, width: '85%' }} />
            <div style={{ height: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 4, marginBottom: 4, width: '60%' }} />
            <div style={{ height: 9, background: 'rgba(255,255,255,0.05)', borderRadius: 4, width: '45%' }} />
          </div>
        </div>
        {/* After card */}
        <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 70, height: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 4, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 9, background: 'rgba(255,255,255,0.07)', borderRadius: 3, marginBottom: 4 }} />
            <div style={{ height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 3, width: '70%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────
export default function ThumbnailGeneratorClient() {
  const [prompt, setPrompt] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('cinematic')
  const [generateCount, setGenerateCount] = useState<1 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [error, setError] = useState('')
  const [optimizedPrompt, setOptimizedPrompt] = useState('')
  const [showOptimized, setShowOptimized] = useState(false)
  const [dailyUsed, setDailyUsed] = useState(() => getDailyUsage())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // KINEO-CHARLOCK-V2 — character lock state. Selecting a character NEVER
  // touches the prompt (the style buttons overwrite it — known trap; the
  // character selector must not repeat that bug).
  const [characters, setCharacters] = useState<CharacterChip[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('')
  const [lockedName, setLockedName] = useState<string>('')
  const [charSaving, setCharSaving] = useState(false)
  const [charMsg, setCharMsg] = useState('')

  useEffect(() => {
    fetch('/api/characters', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { characters: [] }))
      .then((d) => {
        if (Array.isArray(d?.characters)) setCharacters(d.characters)
      })
      .catch(() => {})
  }, [])

  async function handleSaveAsCharacter() {
    const img = images[selectedIdx]
    if (!img || charSaving) return
    const name = (window.prompt('Name this character (e.g. "Rick — finance host"):') ?? '').trim()
    if (!name) return
    setCharSaving(true)
    setCharMsg('')
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, imageUrl: img, source: 'other' }),
      })
      const data = await res.json()
      if (!res.ok || !data?.character) {
        setCharMsg(typeof data?.error === 'string' ? data.error : 'Could not save the character.')
        return
      }
      setCharacters((cs) => [data.character, ...cs])
      setSelectedCharacterId(data.character.id)
      setCharMsg(`✓ "${name}" saved — every new generation with it will keep this exact face.`)
    } catch {
      setCharMsg('Could not save the character. Please try again.')
    } finally {
      setCharSaving(false)
    }
  }

  const remainingFree = Math.max(FREE_DAILY_LIMIT - dailyUsed, 0)
  const isLimitReached = remainingFree <= 0

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) { setError('Enter a prompt first.'); return }
    if (isLimitReached) { setError('Daily free limit reached. Upgrade to Pro for unlimited thumbnails.'); return }
    setError('')
    setImages([])
    setOptimizedPrompt('')
    setShowOptimized(false)
    setLoading(true)

    try {
      const res = await fetch('/api/generate-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // KINEO-CHARLOCK-V2 — characterId flips the server to images.EDIT with
        // the saved anchor (same real face, new scene/angle/outfit).
        body: JSON.stringify({ prompt: prompt.trim(), style: selectedStyle, count: generateCount, ...(selectedCharacterId ? { characterId: selectedCharacterId } : {}) }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Generation failed. Try again.')
        return
      }

      setImages(data.images ?? [])
      setOptimizedPrompt(data.optimizedPrompt ?? '')
      setLockedName(typeof data.lockedTo === 'string' ? data.lockedTo : '')
      setSelectedIdx(0)

      // Increment daily usage
      const newCount = incrementDailyUsage()
      setDailyUsed(newCount)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
    // KINEO-CHARLOCK-V2 fix — selectedCharacterId MUST be a dep: without it
    // the memoized callback kept a stale '' and silently dropped the lock
    // whenever the character was picked after the prompt (review catch).
  }, [prompt, selectedStyle, generateCount, isLimitReached, selectedCharacterId])

  async function handleDownloadSelected() {
    const url = images[selectedIdx]
    if (!url) return
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `thumbnail-selected-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(url, '_blank')
    }
  }

  const selectedImage = images[selectedIdx] ?? null

  return (
    <div style={{ padding: '28px 28px 48px', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        .thumb-style-btn {
          transition: all 0.18s ease;
        }
        .thumb-style-btn:hover {
          transform: translateY(-2px);
          border-color: rgba(41,151,255,.4) !important;
          box-shadow: 0 6px 24px rgba(41,151,255,.15) !important;
        }
        .thumb-generate-btn {
          transition: all 0.2s ease;
        }
        .thumb-generate-btn:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(41,151,255,.45) !important;
          filter: brightness(1.08);
        }
        .thumb-var-btn {
          transition: all 0.15s ease;
        }
        .thumb-var-btn:hover {
          transform: translateY(-1px);
        }
      `}</style>

      {/* ── Page header ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: '0.65rem',
            fontWeight: 900,
            color: '#2997ff',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#2997ff' }} />
          Thumbnail Generator
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#2997ff' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #2997ff, #2997ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              boxShadow: '0 0 32px rgba(41,151,255,.4)',
              flexShrink: 0,
            }}
          >
            🖼️
          </div>
          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontSize: 'clamp(1.45rem, 3vw, 1.9rem)',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #F5F7FF 30%, #2997ff 80%, #2997ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1.08,
                margin: 0,
              }}
            >
              AI Thumbnail Generator
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '4px 0 0', lineHeight: 1.5 }}>
              Generate click-worthy YouTube thumbnails with AI — in seconds.
            </p>
          </div>

          {/* KINEO-DL-PAYWALL-2026-07-09 — "N free today" / "Free limit reached"
              badges removed per Joseph: the product no longer advertises free
              usage. The daily free-limit logic itself is untouched server-side;
              this only cleans the header. */}
        </div>
      </div>

      {/* ── Layout: left panel + right preview ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: Input panel ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Prompt */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: 'var(--muted2)', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              📝 Describe your thumbnail
            </label>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleGenerate() }}
              placeholder="e.g. Pyramid mystery, money secrets exposed, gaming world record..."
              rows={4}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '12px 14px',
                color: 'var(--text)',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(16, 185, 129,0.5)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              maxLength={400}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)' }}>
                ⌘↵ to generate
              </span>
              <span style={{ fontSize: '0.68rem', color: prompt.length > 350 ? '#f87171' : 'rgba(255,255,255,0.25)' }}>
                {prompt.length}/400
              </span>
            </div>
          </div>

          {/* KINEO-CHARLOCK-V2 — character selector. Picking a character only
              sets the id (NEVER rewrites the prompt — the style buttons do
              that and it's a known trap). */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: selectedCharacterId ? '1px solid rgba(41,151,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: 'var(--muted2)', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              🎭 Use character <span style={{ textTransform: 'none', fontWeight: 600, color: 'var(--muted)' }}>— same face, new scene</span>
            </label>
            {characters.length === 0 ? (
              <p style={{ fontSize: '0.74rem', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
                🔒 Save a character from any generated image (paid plans) and every future thumbnail, angle or outfit keeps the <b style={{ color: 'var(--text2)' }}>exact same face</b>.{' '}
                <a href="/pricing" style={{ color: '#2997ff', fontWeight: 700 }}>Unlock →</a>
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelectedCharacterId('')}
                  style={{
                    borderRadius: 10, padding: '8px 12px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer',
                    background: !selectedCharacterId ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: !selectedCharacterId ? '1px solid rgba(41,151,255,0.45)' : '1px solid rgba(255,255,255,0.08)',
                    color: !selectedCharacterId ? '#2997ff' : 'var(--muted)',
                  }}
                >
                  ✨ No character
                </button>
                {characters.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCharacterId(c.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      borderRadius: 999, padding: '4px 12px 4px 4px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer',
                      background: selectedCharacterId === c.id ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.03)',
                      border: selectedCharacterId === c.id ? '1px solid rgba(41,151,255,0.45)' : '1px solid rgba(255,255,255,0.08)',
                      color: selectedCharacterId === c.id ? '#2997ff' : 'var(--muted)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image_url} alt={c.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {selectedCharacterId && (
              <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
                Describe only the <b style={{ color: 'var(--text2)' }}>change</b> in the prompt — new angle, outfit, scene or expression. The face stays locked.
              </p>
            )}
          </div>

          {/* Style selector */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: 'var(--muted2)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              🎨 Thumbnail style
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  className="thumb-style-btn"
                  onClick={() => { setSelectedStyle(s.id); setPrompt(s.sample) }}
                  style={{
                    background:
                      selectedStyle === s.id
                        ? 'linear-gradient(135deg, rgba(41,151,255,.15), rgba(139,92,246,.1))'
                        : 'rgba(255,255,255,0.03)',
                    border:
                      selectedStyle === s.id
                        ? '1px solid rgba(41,151,255,.45)'
                        : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: selectedStyle === s.id ? '0 0 20px rgba(41,151,255,.18)' : 'none',
                  }}
                >
                  <div style={{ fontSize: '1.1rem', marginBottom: 3 }}>{s.emoji}</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: selectedStyle === s.id ? '#2997ff' : 'var(--text)', lineHeight: 1.1 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 2 }}>
                    {s.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Variation count */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: 'var(--muted2)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              🎲 Variations
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {([1, 3] as const).map((n) => (
                <button
                  key={n}
                  className="thumb-var-btn"
                  onClick={() => setGenerateCount(n)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 10,
                    border: generateCount === n ? '1px solid rgba(41,151,255,.45)' : '1px solid rgba(255,255,255,0.08)',
                    background: generateCount === n
                      ? 'linear-gradient(135deg, rgba(41,151,255,.15), rgba(139,92,246,.1))'
                      : 'rgba(255,255,255,0.03)',
                    color: generateCount === n ? '#2997ff' : 'var(--muted)',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: generateCount === n ? '0 0 16px rgba(41,151,255,.15)' : 'none',
                  }}
                >
                  {n === 1 ? '1 thumbnail' : '3 variations'}
                  {n === 3 && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.6rem',
                        marginTop: 2,
                        color: 'rgba(52, 211, 153,0.7)',
                      }}
                    >
                      counts as 1
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Push #081 — Thumbnail credit pricing table.
              Shown BEFORE the generate button so the user knows the
              cost of each option up-front. The currently-selected
              option is highlighted. Credits are charged only on a
              successful generation (the API caller handles the
              deduction; this UI just surfaces the price). */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                💎 Thumbnail Credits
              </label>
              <span
                style={{
                  background: 'rgba(41,151,255,0.15)',
                  color: '#2997ff',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  padding: '3px 8px',
                  borderRadius: 999,
                  letterSpacing: '0.08em',
                  border: '1px solid rgba(41,151,255,0.35)',
                }}
              >
                BETA
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { key: 1, label: '1 thumbnail', credits: 5, selected: generateCount === 1 },
                { key: 3, label: '3 variations', credits: 10, selected: generateCount === 3 },
                { key: 'pro', label: 'Pro pack — 3 variations + cinematic + text suggestions', credits: 15, selected: false, soon: true },
              ].map((row) => (
                <div
                  key={row.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 9,
                    border: row.selected ? '1px solid rgba(16, 185, 129,0.45)' : '1px solid rgba(255,255,255,0.06)',
                    background: row.selected ? 'rgba(16, 185, 129,0.10)' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: '0.78rem', color: row.selected ? '#2997ff' : 'var(--text)', fontWeight: row.selected ? 800 : 600 }}>
                    {row.label}
                    {row.soon && (
                      <span style={{ marginLeft: 8, fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                        soon
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 900, color: row.selected ? '#2997ff' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {row.credits} credits
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginTop: 10, lineHeight: 1.5 }}>
              Credits are charged only when thumbnails are successfully generated.
            </p>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim() || isLimitReached}
            className="thumb-generate-btn"
            style={{
              width: '100%',
              padding: '15px 0',
              borderRadius: 13,
              border: 'none',
              fontSize: '0.95rem',
              fontWeight: 900,
              color: '#fff',
              cursor: loading || !prompt.trim() || isLimitReached ? 'not-allowed' : 'pointer',
              background:
                loading || !prompt.trim() || isLimitReached
                  ? 'rgba(41,151,255,.18)'
                  : 'linear-gradient(135deg, #2997ff, #2997ff)',
              boxShadow:
                loading || !prompt.trim() || isLimitReached
                  ? 'none'
                  : '0 6px 32px rgba(41,151,255,.35)',
              letterSpacing: '0.02em',
            }}
          >
            {loading
              ? '✨ Generating…'
              : isLimitReached
              ? '🔒 Upgrade for unlimited'
              : generateCount === 3
              ? '🖼️ Generate 3 Variations'
              : '🖼️ Generate Thumbnail'}
          </button>

          {/* Upgrade CTA if limit reached */}
          {isLimitReached && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129,0.12), rgba(5, 150, 105,0.08))',
                border: '1px solid rgba(16, 185, 129,0.25)',
                borderRadius: 13,
                padding: 16,
                textAlign: 'center',
              }}
            >
              <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '0.88rem', marginBottom: 6 }}>
                🚀 Unlock Unlimited Thumbnails
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: 12, lineHeight: 1.5 }}>
                Pro users get unlimited HD thumbnails, premium styles, and priority generation.
              </p>
              <a
                href="/pricing"
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #2997ff, #2997ff)',
                  color: '#fff',
                  textDecoration: 'none',
                  borderRadius: 9,
                  padding: '9px 24px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  boxShadow: '0 0 20px rgba(16, 185, 129,0.3)',
                }}
              >
                ⚡ Upgrade to Pro →
              </a>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10,
                padding: '12px 16px',
                color: '#f87171',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Optimized prompt disclosure */}
          {optimizedPrompt && !loading && (
            <button
              onClick={() => setShowOptimized((v) => !v)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 9,
                padding: '8px 14px',
                color: 'var(--muted)',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{showOptimized ? '▲' : '▼'}</span>
              <span>AI-optimized prompt</span>
            </button>
          )}
          {showOptimized && optimizedPrompt && (
            <div
              style={{
                background: 'rgba(16, 185, 129,0.06)',
                border: '1px solid rgba(16, 185, 129,0.18)',
                borderRadius: 10,
                padding: '12px 14px',
                color: 'rgba(52, 211, 153,0.85)',
                fontSize: '0.73rem',
                lineHeight: 1.6,
                fontStyle: 'italic',
              }}
            >
              {optimizedPrompt}
            </div>
          )}
        </div>

        {/* ── RIGHT: Preview panel ───────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Main preview area */}
          <div
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
                🖼️ Preview
                {/* KINEO-CHARLOCK-V2 — identity badge on locked results. */}
                {lockedName && images.length > 0 && !loading && (
                  <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.68rem', fontWeight: 800, color: '#2997ff', background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.35)', borderRadius: 999, padding: '3px 10px' }}>
                    🔒 Locked to {lockedName}
                  </span>
                )}
              </span>
              {selectedImage && !loading && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* KINEO-CHARLOCK-V2 — save THIS result as a reusable character. */}
                  <button
                    onClick={handleSaveAsCharacter}
                    disabled={charSaving}
                    style={{
                      background: 'rgba(41,151,255,0.12)',
                      color: '#2997ff',
                      border: '1px solid rgba(41,151,255,0.4)',
                      borderRadius: 8,
                      padding: '6px 14px',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: charSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {charSaving ? '⭐ Saving…' : '⭐ Save as Character'}
                  </button>
                  <button
                    onClick={handleDownloadSelected}
                    style={{
                      background: 'linear-gradient(135deg, #2997ff, #2997ff)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 16px',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 0 14px rgba(41,151,255,0.35)',
                    }}
                  >
                    ⬇ Download HD
                  </button>
                </div>
              )}
            </div>
            {charMsg && (
              <p style={{ fontSize: '0.74rem', fontWeight: 700, color: charMsg.startsWith('✓') ? '#5cb3ff' : '#f87171', margin: '0 0 10px' }}>
                {charMsg}
              </p>
            )}

            {/* Loading skeleton */}
            {loading && <Skeleton />}

            {/* Empty state */}
            {!loading && images.length === 0 && (
              <div
                style={{
                  aspectRatio: '16/9',
                  borderRadius: 12,
                  border: '1.5px dashed rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  color: 'rgba(255,255,255,0.25)',
                }}
              >
                <span style={{ fontSize: '3rem', opacity: 0.4 }}>🖼️</span>
                <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Your thumbnail will appear here
                </p>
                <p style={{ fontSize: '0.72rem', opacity: 0.7 }}>
                  Enter a prompt and click Generate
                </p>
              </div>
            )}

            {/* Selected image (large) */}
            {!loading && selectedImage && (
              <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage}
                  alt="Generated thumbnail"
                  style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }}
                />
              </div>
            )}
          </div>

          {/* Variations grid (if multiple) */}
          {!loading && images.length > 1 && (
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>
                ✨ Variations — click to select
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${images.length}, 1fr)`, gap: 10 }}>
                {images.map((url, i) => (
                  <ThumbnailCard
                    key={url}
                    url={url}
                    index={i}
                    selected={selectedIdx === i}
                    onSelect={() => setSelectedIdx(i)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* YouTube Feed Preview */}
          {!loading && selectedImage && (
            <YouTubeFeedPreview url={selectedImage} />
          )}

          {/* Pro features teaser */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129,0.08), rgba(5, 150, 105,0.06))',
              border: '1px solid rgba(16, 185, 129,0.2)',
              borderRadius: 14,
              padding: 18,
            }}
          >
            <p style={{ fontSize: '0.8rem', fontWeight: 900, color: '#2997ff', marginBottom: 10 }}>
              ⚡ Pro Features
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { icon: '♾️', text: 'Unlimited thumbnails per day' },
                { icon: '🎨', text: 'HD quality (1792×1024)' },
                { icon: '🚀', text: 'Priority generation queue' },
                { icon: '🎲', text: '3 variations per generation' },
                { icon: '🖼️', text: 'Premium style presets' },
              ].map((f) => (
                <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: '0.9rem' }}>{f.icon}</span>
                  <span style={{ fontSize: '0.76rem', color: 'rgba(52, 211, 153,0.85)' }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}
