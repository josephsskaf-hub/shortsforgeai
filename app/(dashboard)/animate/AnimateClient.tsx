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

export default function AnimateClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [prompt, setPrompt] = useState(MOTION_PRESETS[0].prompt)
  const [duration, setDuration] = useState<'5' | '10'>('5')
  const [credits, setCredits] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!isLoggedIn) return
    fetch('/api/credits', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setCredits(typeof d?.credits === 'number' ? d.credits : 0))
      .catch(() => {})
    return () => { cancelledRef.current = true }
  }, [isLoggedIn])

  const busy = phase === 'uploading' || phase === 'submitting' || phase === 'animating'
  const canGenerate = isLoggedIn && !!photoUrl && !busy

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

  async function handleGenerate() {
    if (!canGenerate || !photoUrl) return
    setError(null)
    setResultUrl(null)
    setPhase('submitting')
    try {
      const res = await fetch('/api/animate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: photoUrl, prompt: prompt.trim(), duration }),
      })
      const data = await res.json()
      if (res.status === 402) {
        setError(typeof data?.error === 'string' ? data.error : 'Not enough credits.')
        setPhase('failed')
        return
      }
      if (!res.ok || typeof data?.request_id !== 'string') {
        setError(typeof data?.error === 'string' ? data.error : 'Could not start. Please try again.')
        setPhase('failed')
        return
      }
      if (typeof data.balance === 'number') setCredits(data.balance)
      try { window.dispatchEvent(new Event('creditsChanged')) } catch {}
      setPhase('animating')
      void poll(data.request_id)
    } catch {
      setError('Could not start. Please try again.')
      setPhase('failed')
    }
  }

  async function poll(requestId: string) {
    try {
      const res = await fetch(`/api/avatar-status?request_id=${encodeURIComponent(requestId)}&engine=animate`, { cache: 'no-store' })
      const data = await res.json()
      if (cancelledRef.current) return
      if (data.status === 'done' && typeof data.video_url === 'string') {
        setResultUrl(data.video_url)
        setPhase('done')
        return
      }
      if (data.status === 'failed') {
        setError('Animation failed. Email support@shortsforgeai.com and we will restore your credits.')
        setPhase('failed')
        return
      }
      setTimeout(() => poll(requestId), 5000)
    } catch {
      setTimeout(() => poll(requestId), 7000)
    }
  }

  return (
    <div className="px-4 sm:px-6 py-7 pb-20">
      <div className="mb-7">
        <div className="font-black uppercase tracking-[.18em] mb-2" style={{ fontSize: '0.65rem', color: '#A78BFA' }}>
          Animate
        </div>
        <h1 className="font-display font-bold tracking-tight" style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}>
          One photo. <span className="grad-text">Suddenly alive.</span>
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted2)' }}>
          People, pets, products, old family pictures — upload a photo and watch it move.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px] items-start" style={{ maxWidth: 1060 }}>
        <div className="flex flex-col gap-5">
          <section className="neon-card p-5">
            <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted2)' }}>1 · The photo</h2>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-xl px-4 py-2.5 text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              {photoUrl ? '🖼️ Choose a different photo' : '🖼️ Upload a photo'}
            </button>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            <p className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>Any photo works — sharp and well-lit animates best. JPG/PNG.</p>
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
                    background: prompt === p.prompt ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                    border: prompt === p.prompt ? '1px solid rgba(167,139,250,0.5)' : '1px solid var(--border)',
                    color: prompt === p.prompt ? '#A78BFA' : 'var(--muted2)',
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
                    background: duration === d ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                    border: duration === d ? '1px solid rgba(167,139,250,0.5)' : '1px solid var(--border)',
                    color: duration === d ? '#A78BFA' : 'var(--muted2)',
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
              {busy ? PHASE_COPY[phase] : '✨ Bring it to life — 10 credits'}
            </button>
            <p className="text-[12px] text-center" style={{ color: 'var(--muted)' }}>
              10 credits per clip ·{' '}
              <span style={{ color: (credits ?? 0) >= 10 ? '#A78BFA' : '#f87171', fontWeight: 700 }}>
                you have {credits === null ? '—' : credits}
              </span>
              {!isLoggedIn && (
                <>
                  {' '}· <Link href="/login?redirect=/animate" style={{ color: '#A78BFA', fontWeight: 700 }}>sign in</Link>
                </>
              )}
            </p>
          </section>
        </div>

        <div className="hidden lg:flex flex-col items-center gap-4 sticky top-20">
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
