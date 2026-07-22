'use client'

// Animate (13/06) — the focused image-to-video page (/animate).
// Upload ANY photo (person, pet, product, old family picture), describe the
// motion, get a living 5-10s clip. Kling 2.5 Turbo Pro via the fal queue;
// costs ANIMATE_COST video_credits (debited upfront, atomic RPC).
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Phase = 'idle' | 'uploading' | 'submitting' | 'animating' | 'done' | 'failed'

const PHASE_COPY: Record<Phase, string> = {
  idle: '',
  uploading: 'Uploading your photo…',
  submitting: 'Sending to the motion engine…',
  animating: 'Bringing your photo to life… (1–3 min)',
  done: 'Alive!',
  failed: 'Something went wrong.',
}

const MOTION_PRESETS: Array<{ label: string; prompt: string }> = [
  { label: '🌬️ Subtle & real', prompt: 'subtle natural motion, gentle breathing, soft wind, cinematic realism' },
  { label: '🎥 Slow camera push', prompt: 'slow cinematic camera push-in, parallax depth, photorealistic motion' },
  { label: '😊 Person comes alive', prompt: 'the person blinks, smiles softly and shifts naturally, realistic facial motion' },
  { label: '🌊 Scenery flows', prompt: 'water flows, clouds drift, leaves sway in the wind, living landscape' },
]

const SUBMISSION_STORAGE_PREFIX = 'kineo:animate:submission:v1'

type StoredSubmission = {
  userId: string
  fingerprint: string
  key: string
  sourceType: 'upload' | 'url'
  source: string
  prompt: string
  duration: '5' | '10'
  requestId?: string
  imageUrl?: string
}

function submissionStorageKey(userId: string): string {
  return `${SUBMISSION_STORAGE_PREFIX}:${userId}`
}

function readStoredSubmission(userId: string): StoredSubmission | null {
  try {
    const raw = localStorage.getItem(submissionStorageKey(userId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StoredSubmission>
    if (
      typeof value.userId !== 'string' || typeof value.fingerprint !== 'string' || typeof value.key !== 'string' ||
      (value.sourceType !== 'upload' && value.sourceType !== 'url') ||
      typeof value.source !== 'string' || typeof value.prompt !== 'string' ||
      (value.duration !== '5' && value.duration !== '10')
    ) return null
    return value as StoredSubmission
  } catch {
    return null
  }
}

function writeStoredSubmission(value: StoredSubmission) {
  try { localStorage.setItem(submissionStorageKey(value.userId), JSON.stringify(value)) } catch {}
}

function clearStoredSubmission(userId: string | null | undefined) {
  if (!userId) return
  try { localStorage.removeItem(submissionStorageKey(userId)) } catch {}
}

export default function AnimateClient({ isLoggedIn, userId }: { isLoggedIn: boolean; userId: string | null }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [remoteImageUrl, setRemoteImageUrl] = useState('')
  const [prompt, setPrompt] = useState(MOTION_PRESETS[0].prompt)
  const [duration, setDuration] = useState<'5' | '10'>('5')
  const [credits, setCredits] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const cancelledRef = useRef(false)
  const submitGuardRef = useRef(false)
  const submissionRef = useRef<{ fingerprint: string; key: string } | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const pollTimerRef = useRef<number | null>(null)

  useEffect(() => {
    cancelledRef.current = false
    if (!isLoggedIn || !userId) return
    void refreshCredits(false)

    // Survive reload/navigation while the provider is working. This also
    // preserves the same idempotency key after a lost POST response.
    const stored = readStoredSubmission(userId)
    if (stored && stored.userId !== userId) {
      clearStoredSubmission(userId)
    } else if (stored) {
      submissionRef.current = { fingerprint: stored.fingerprint, key: stored.key }
      setPrompt(stored.prompt)
      setDuration(stored.duration)
      if (stored.requestId) {
        if (stored.imageUrl || stored.sourceType === 'upload') {
          setPhotoUrl(stored.imageUrl ?? stored.source)
          setRemoteImageUrl('')
        } else {
          setRemoteImageUrl(stored.source)
        }
        setPhase('animating')
        void poll(stored.requestId)
      } else if (stored.sourceType === 'upload') {
        setPhotoUrl(stored.source)
        setRemoteImageUrl('')
      } else {
        setPhotoUrl(null)
        setRemoteImageUrl(stored.source)
      }
      if (!stored.requestId) {
        setPhase(stored.sourceType === 'url' ? 'uploading' : 'submitting')
        retryTimerRef.current = window.setTimeout(() => void submitStoredSubmission(stored), 500)
      }
    }
    return () => {
      cancelledRef.current = true
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
      if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current)
    }
  }, [isLoggedIn, userId])

  const busy = phase === 'uploading' || phase === 'submitting' || phase === 'animating'
  const hasImageSource = !!photoUrl || remoteImageUrl.trim().length > 0
  const canGenerate = isLoggedIn && hasImageSource && !busy

  async function refreshCredits(announce = true) {
    try {
      const res = await fetch('/api/credits', { cache: 'no-store' })
      const data = await res.json()
      if (typeof data?.credits === 'number') setCredits(data.credits)
      if (announce) window.dispatchEvent(new Event('creditsChanged'))
    } catch {}
  }

  async function compressPhoto(file: File): Promise<File> {
    if (file.size < 2 * 1024 * 1024) return file
    try {
      const bitmap = await createImageBitmap(file)
      const maxSide = 1600
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file
    } catch {
      return file
    }
  }

  async function handleFile(raw: File | null) {
    if (!raw) return
    clearStoredSubmission(userId)
    submissionRef.current = null
    setRemoteImageUrl('')
    setError(null)
    setResultUrl(null)
    setPhase('uploading')
    try {
      const file = await compressPhoto(raw)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('rights', 'true')
      fd.append('purpose', 'animate')
      const res = await fetch('/api/avatar/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || typeof data?.url !== 'string') {
        setError(typeof data?.error === 'string' ? data.error : 'Upload failed. Please try again.')
        setPhase('idle')
        return
      }
      setPhotoUrl(data.url)
      setPhase('idle')
    } catch {
      setError('Upload failed. Please try again.')
      setPhase('idle')
    }
  }

  function handleRemoteImageUrl(value: string) {
    clearStoredSubmission(userId)
    submissionRef.current = null
    setRemoteImageUrl(value)
    if (value.trim()) setPhotoUrl(null)
    setResultUrl(null)
    setError(null)
    if (phase === 'done' || phase === 'failed') setPhase('idle')
  }

  function scheduleSubmissionRetry(stored: StoredSubmission, delayMs: number) {
    if (cancelledRef.current) return
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
    setPhase(stored.sourceType === 'url' ? 'uploading' : 'submitting')
    setError('Connection interrupted. Recovering this same request automatically — no second charge.')
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      void submitStoredSubmission(stored)
    }, Math.max(1000, delayMs))
  }

  async function submitStoredSubmission(stored: StoredSubmission) {
    if (submitGuardRef.current || cancelledRef.current) return
    submitGuardRef.current = true
    setResultUrl(null)
    setPhase(stored.sourceType === 'url' ? 'uploading' : 'submitting')
    try {
      const res = stored.sourceType === 'url'
        ? await fetch('/api/animate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': stored.key },
            body: JSON.stringify({
              image_url: stored.source,
              motion_prompt: stored.prompt,
              duration: stored.duration,
              idempotency_key: stored.key,
            }),
          })
        : await fetch('/api/animate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': stored.key },
            body: JSON.stringify({
              imageUrl: stored.source,
              prompt: stored.prompt,
              duration: stored.duration,
              idempotencyKey: stored.key,
            }),
          })
      let responseParsed = true
      const data = await res.json().catch(() => {
        responseParsed = false
        return {} as Record<string, unknown>
      })
      if (data?.use_new_idempotency_key === true) {
        submissionRef.current = null
        clearStoredSubmission(stored.userId)
      }
      if (res.status === 402) {
        submissionRef.current = null
        clearStoredSubmission(stored.userId)
        setError(typeof data?.error === 'string' ? data.error : 'Not enough credits.')
        setPhase('failed')
        return
      }
      if (!res.ok || typeof data?.request_id !== 'string') {
        const acceptedBodyWasLost = res.ok && typeof data?.request_id !== 'string'
        const ambiguousConflict = res.status === 409 && !responseParsed
        const ambiguousResponse = (acceptedBodyWasLost || ambiguousConflict || res.status === 408 || res.status === 425 || res.status >= 500) &&
          data?.use_new_idempotency_key !== true
        if (data?.pending === true || ambiguousResponse) {
          const retryHeader = res.headers.get('Retry-After')
          const retrySeconds = retryHeader === null ? Number.NaN : Number(retryHeader)
          scheduleSubmissionRetry(stored, Number.isFinite(retrySeconds) && retrySeconds > 0 ? retrySeconds * 1000 : 5000)
          return
        }
        if (res.status === 401) {
          setError('Your session expired. Sign in again, then return here to recover this same request safely.')
          setPhase(stored.sourceType === 'url' ? 'uploading' : 'submitting')
          window.location.assign('/login?redirect=/animate')
          return
        }
        if (res.status !== 401) {
          submissionRef.current = null
          clearStoredSubmission(stored.userId)
        }
        setError(typeof data?.error === 'string' ? data.error : 'Could not start. Please try again.')
        setPhase('failed')
        return
      }

      setError(null)
      if (typeof data.balance === 'number') setCredits(data.balance)
      if (typeof data.image_url === 'string') {
        setPhotoUrl(data.image_url)
        setRemoteImageUrl('')
      }
      writeStoredSubmission({
        ...stored,
        requestId: data.request_id,
        imageUrl: typeof data.image_url === 'string' ? data.image_url : undefined,
      })
      try { window.dispatchEvent(new Event('creditsChanged')) } catch {}
      setPhase('animating')
      void poll(data.request_id)
    } catch {
      // The server may have accepted and charged this POST before the network
      // broke. Keep the controls locked and recover with the exact same key.
      scheduleSubmissionRetry(stored, 5000)
    } finally {
      submitGuardRef.current = false
    }
  }

  function handleGenerate() {
    if (!canGenerate || submitGuardRef.current || !userId) return
    setError(null)
    setResultUrl(null)
    const source = photoUrl ?? remoteImageUrl.trim()
    const fingerprint = JSON.stringify({ source, prompt: prompt.trim(), duration })
    if (!submissionRef.current || submissionRef.current.fingerprint !== fingerprint) {
      submissionRef.current = {
        fingerprint,
        key: globalThis.crypto?.randomUUID?.() ??
          `animate-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }
    }
    const stored: StoredSubmission = {
      userId,
      fingerprint,
      key: submissionRef.current.key,
      sourceType: photoUrl ? 'upload' : 'url',
      source,
      prompt: prompt.trim(),
      duration,
    }
    writeStoredSubmission(stored)
    void submitStoredSubmission(stored)
  }

  async function poll(requestId: string) {
    try {
      const res = await fetch(`/api/avatar-status?request_id=${encodeURIComponent(requestId)}&engine=animate`, { cache: 'no-store' })
      const data = await res.json()
      if (cancelledRef.current) return
      if (res.status === 401) {
        setError('Your session expired. Sign in again to resume this animation safely.')
        setPhase('animating')
        window.location.assign('/login?redirect=/animate')
        return
      }
      if (res.status === 404) {
        submissionRef.current = null
        clearStoredSubmission(userId)
        setError('This animation could not be found for the current account.')
        setPhase('failed')
        return
      }
      if (data.status === 'done' && typeof data.video_url === 'string') {
        submissionRef.current = null
        clearStoredSubmission(userId)
        setResultUrl(data.video_url)
        setPhase('done')
        return
      }
      if (data.status === 'failed') {
        submissionRef.current = null
        clearStoredSubmission(userId)
        setError(typeof data?.error === 'string' ? data.error : 'Animation failed. Your credits were automatically restored.')
        setPhase('failed')
        void refreshCredits()
        return
      }
      if (!cancelledRef.current) {
        pollTimerRef.current = window.setTimeout(() => void poll(requestId), 5000)
      }
    } catch {
      if (!cancelledRef.current) {
        pollTimerRef.current = window.setTimeout(() => void poll(requestId), 7000)
      }
    }
  }

  return (
    <div className="px-4 sm:px-6 py-7 pb-20">
      <div className="mb-7">
        <div className="font-black uppercase tracking-[.18em] mb-2" style={{ fontSize: '0.65rem', color: '#2997ff' }}>
          Animate
        </div>
        <h1 className="font-display font-bold tracking-tight" style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}>
          One photo. <span className="grad-text">Suddenly alive.</span>
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted2)' }}>
          People, pets, products, old family pictures — upload a photo or paste a public image link and watch it move.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px] items-start" style={{ maxWidth: 1060 }}>
        <div className="flex flex-col gap-5">
          <section className="neon-card p-5">
            <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted2)' }}>1 · The photo</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="rounded-xl px-4 py-2.5 text-sm font-bold sm:flex-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {photoUrl ? '🖼️ Choose a different photo' : '🖼️ Upload a photo'}
              </button>
              <input
                type="url"
                value={remoteImageUrl}
                onChange={(event) => handleRemoteImageUrl(event.target.value)}
                disabled={busy}
                maxLength={2048}
                placeholder="or paste a public image link (.jpg or .png)"
                aria-label="Public image URL"
                className="min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-sm"
                style={{ background: 'rgba(0,0,0,.3)', border: '1px solid var(--border2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            <p className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>JPG/PNG up to 8 MB. Public links are downloaded and validated securely on our server.</p>
            {error && <p className="text-xs mt-3 font-semibold rounded-lg px-3 py-2" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }} role="alert">⚠️ {error}</p>}
          </section>

          <section className="neon-card p-5">
            <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted2)' }}>2 · The motion</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {MOTION_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={busy}
                  onClick={() => setPrompt(p.prompt)}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-bold"
                  style={{
                    background: prompt === p.prompt ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: prompt === p.prompt ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)',
                    color: prompt === p.prompt ? '#2997ff' : 'var(--muted2)',
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={busy}
              maxLength={500}
              rows={3}
              className="w-full rounded-xl px-3.5 py-3 text-sm leading-relaxed resize-none"
              style={{ background: 'rgba(0,0,0,.3)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
            />
            <div className="flex gap-2 mt-3">
              {(['5', '10'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={busy}
                  onClick={() => setDuration(d)}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-bold"
                  style={{
                    background: duration === d ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: duration === d ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)',
                    color: duration === d ? '#2997ff' : 'var(--muted2)',
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  {d}s
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="btn-neon w-full px-6 py-4 text-base disabled:opacity-50"
              style={{ cursor: canGenerate ? 'pointer' : 'not-allowed' }}
            >
              {/* KINEO-REBASE-2026-07-10 — 10 → 5 credits (2:1 rebase; matches ANIMATE_COST) */}
              {busy ? PHASE_COPY[phase] : '✨ Bring it to life — 5 credits'}
            </button>
            <p className="text-[12px] text-center" style={{ color: 'var(--muted)' }}>
              5 credits per clip ·{' '}
              <span style={{ color: (credits ?? 0) >= 5 ? '#2997ff' : '#f87171', fontWeight: 700 }}>
                you have {credits === null ? '—' : credits}
              </span>
              {!isLoggedIn && (
                <>
                  {' '}· <Link href="/login?redirect=/animate" style={{ color: '#2997ff', fontWeight: 700 }}>sign in</Link>
                </>
              )}
            </p>
          </section>
        </div>

        <div className="flex flex-col items-center gap-4 lg:sticky lg:top-20">
          <div
            style={{
              width: 280, height: 420, borderRadius: 24, overflow: 'hidden', position: 'relative',
              background: '#0D0D0F', border: '1px solid var(--border2)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            }}
          >
            {phase === 'done' && resultUrl ? (
              <video src={resultUrl} controls autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Your photo" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: busy ? 0.45 : 1 }} />
            ) : remoteImageUrl.trim() ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center" style={{ color: 'var(--muted2)' }}>
                <span style={{ fontSize: 38 }}>🔗</span>
                <span className="text-xs font-bold" style={{ color: 'var(--text2)' }}>Image link ready</span>
                <span className="text-[11px] leading-relaxed">Kineo will fetch and validate it on the server when you animate.</span>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
                <span style={{ fontSize: 40 }}>✨</span>
                <span className="text-xs font-semibold">Upload a photo to preview</span>
              </div>
            )}
            {busy && phase === 'animating' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5" style={{ background: 'rgba(10,10,11,0.55)', backdropFilter: 'blur(2px)' }}>
                <div className="spinner-sm" style={{ position: 'relative' }}><div className="spinner-sm-inner" /></div>
                <p className="text-center text-[12px] font-bold" style={{ color: 'var(--text2)' }}>{PHASE_COPY[phase]}</p>
              </div>
            )}
          </div>
          {phase === 'done' && resultUrl && (
            <>
              <a href={resultUrl} download className="btn-neon w-full text-center px-5 py-3 text-sm" style={{ textDecoration: 'none', maxWidth: 280 }}>
                ⬇ Download MP4
              </a>
              <button
                type="button"
                onClick={() => { setPhase('idle'); setResultUrl(null) }}
                className="text-[12px] font-bold"
                style={{ color: 'var(--muted2)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ↺ Animate another
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
