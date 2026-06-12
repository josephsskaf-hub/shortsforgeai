'use client'

// Avatar Studio (12/06) — the focused AI Avatar environment (/avatar).
// LEFT: everything needed to ship one talking video, nothing else —
//   1. Face: saved faces (one-click) · upload photo · or upload a short VIDEO
//   2. Script: textarea + FREE voice preview (dryRun TTS)
//   3. Coverage (Hook/Full) + engine (Standard/Pro) for photo sources
//   4. Generate (1 avatar credit, debited only on success)
// RIGHT: a live 9:16 phone — shows the chosen face/video before generating,
//   the staged render status while working, and the finished video (play +
//   download) when done.
// Pipeline reused as-is: /api/avatar/upload → /api/generate-avatar →
// /api/avatar-status?engine= → /api/compose → /api/compose/status/[id].
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Phase = 'idle' | 'uploading' | 'submitting' | 'animating' | 'composing' | 'rendering' | 'done' | 'failed'

interface SavedFace { id: string; url: string; created_at: string }

const PHASE_COPY: Record<Phase, string> = {
  idle: '',
  uploading: 'Uploading your file…',
  submitting: 'Writing narration + sending to the avatar engine…',
  animating: 'Animating your avatar — lip-syncing the script…',
  composing: 'Assembling the final video — captions, b-roll, music…',
  rendering: 'Rendering the final MP4…',
  done: 'Ready to post!',
  failed: 'Something went wrong.',
}

export default function AvatarStudioClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  // ── Source state ──────────────────────────────────────────────────────
  const [sourceKind, setSourceKind] = useState<'photo' | 'video'>('photo')
  const [faceUrl, setFaceUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [savedFaces, setSavedFaces] = useState<SavedFace[]>([])
  const [rights, setRights] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)

  // ── Script + options ──────────────────────────────────────────────────
  const [script, setScript] = useState('')
  const [hookMode, setHookMode] = useState(true)
  const [engine, setEngine] = useState<'fabric' | 'omnihuman'>('fabric')

  // ── Voice preview (free dryRun) ───────────────────────────────────────
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  // ── Credits + run state ───────────────────────────────────────────────
  const [avatarCredits, setAvatarCredits] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [finalUrl, setFinalUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const runRef = useRef<{
    requestId: string | null
    engine: string
    voiceoverUrl: string
    voiceoverScript: string
    realAudioDuration: number | null
    hookSeconds: number | null
    clipUrls: string[]
    generationId: string | null
  } | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!isLoggedIn) return
    fetch('/api/avatar/list', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.avatars)) {
          setSavedFaces(d.avatars as SavedFace[])
          if (d.avatars[0]?.url) setFaceUrl(d.avatars[0].url as string)
        }
      })
      .catch(() => {})
    fetch('/api/credits', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAvatarCredits(typeof d?.avatarCredits === 'number' ? d.avatarCredits : 0))
      .catch(() => {})
    return () => { cancelledRef.current = true }
  }, [isLoggedIn])

  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'failed'
  const sourceReady = sourceKind === 'photo' ? !!faceUrl : !!videoUrl
  const canGenerate = isLoggedIn && sourceReady && script.trim().length > 0 && !busy

  // ── Upload (photo or video) ───────────────────────────────────────────
  async function handleFile(file: File | null, kind: 'photo' | 'video') {
    if (!file) return
    setUploadError(null)
    if (!rights) {
      setUploadError('Please confirm you have the right to use this person’s image first (checkbox below).')
      return
    }
    setPhase('uploading')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('rights', 'true')
      const res = await fetch('/api/avatar/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || typeof data?.url !== 'string') {
        setUploadError(typeof data?.error === 'string' ? data.error : 'Upload failed. Please try again.')
        setPhase('idle')
        return
      }
      if (kind === 'video') {
        setVideoUrl(data.url)
        setSourceKind('video')
      } else {
        setFaceUrl(data.url)
        setSourceKind('photo')
        setSavedFaces((prev) => [{ id: data.url, url: data.url, created_at: new Date().toISOString() }, ...prev].slice(0, 6))
      }
      setPhase('idle')
    } catch {
      setUploadError('Upload failed. Please try again.')
      setPhase('idle')
    }
  }

  // ── Free voice preview ────────────────────────────────────────────────
  async function handleVoicePreview() {
    if (voiceLoading) return
    const trimmed = script.trim()
    if (!trimmed) { setVoiceError('Write your script first.'); return }
    setVoiceLoading(true)
    setVoiceError(null)
    try {
      const res = await fetch('/api/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, duration: 52, language: 'en', dryRun: true }),
      })
      const data = await res.json()
      if (!res.ok || typeof data?.voiceover_url !== 'string') {
        setVoiceError(typeof data?.error === 'string' ? data.error : 'Preview failed. Try again.')
        return
      }
      setVoiceUrl(data.voiceover_url)
    } catch {
      setVoiceError('Preview failed. Try again.')
    } finally {
      setVoiceLoading(false)
    }
  }

  // ── The run: generate → poll avatar → compose → poll render ──────────
  async function handleGenerate() {
    if (!canGenerate) return
    setError(null)
    setFinalUrl(null)
    setProgress(8)
    setPhase('submitting')
    try {
      const res = await fetch('/api/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: script.trim(),
          duration: 52,
          language: 'en',
          ...(sourceKind === 'video'
            ? { avatarSourceVideoUrl: videoUrl }
            : { avatarImageUrl: faceUrl, engine }),
          avatarMode: sourceKind === 'photo' && hookMode ? 'hook' : 'full',
        }),
      })
      const data = await res.json()
      if (res.status === 402) {
        setError('You need an Avatar Credit for this video. Grab a pack below — it’s debited only when your video succeeds.')
        setPhase('failed')
        return
      }
      if (!res.ok || typeof data?.avatar_request_id !== 'string') {
        setError(typeof data?.error === 'string' ? data.error : 'Could not start the render. Please try again.')
        setPhase('failed')
        return
      }
      runRef.current = {
        requestId: data.avatar_request_id,
        engine: typeof data.engine === 'string' ? data.engine : 'fabric',
        voiceoverUrl: data.voiceover_url,
        voiceoverScript: typeof data.voiceover_script === 'string' ? data.voiceover_script : script.trim(),
        realAudioDuration: typeof data.real_audio_duration === 'number' ? data.real_audio_duration : null,
        hookSeconds: typeof data.avatar_hook_seconds === 'number' ? data.avatar_hook_seconds : null,
        clipUrls: Array.isArray(data.clip_urls) ? data.clip_urls : [],
        generationId: typeof data.generationId === 'string' ? data.generationId : null,
      }
      setPhase('animating')
      setProgress(25)
      void pollAvatar()
    } catch {
      setError('Could not start the render. Please try again.')
      setPhase('failed')
    }
  }

  async function pollAvatar() {
    const run = runRef.current
    if (!run?.requestId) return
    try {
      const res = await fetch(
        `/api/avatar-status?request_id=${encodeURIComponent(run.requestId)}&engine=${run.engine}`,
        { cache: 'no-store' },
      )
      const data = await res.json()
      if (cancelledRef.current) return
      if (data.status === 'done' && typeof data.video_url === 'string') {
        setProgress(55)
        setPhase('composing')
        void kickCompose(data.video_url)
        return
      }
      if (data.status === 'failed') {
        setError(typeof data.error === 'string' ? data.error : 'Avatar generation failed. You were not charged.')
        setPhase('failed')
        return
      }
      setProgress((p) => Math.min(50, p + 2))
      setTimeout(pollAvatar, 5000)
    } catch {
      setTimeout(pollAvatar, 7000)
    }
  }

  async function kickCompose(avatarVideoUrl: string) {
    const run = runRef.current
    if (!run) return
    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId: run.generationId,
          clip_urls: run.clipUrls,
          voiceover_script: run.voiceoverScript,
          scene_captions: [],
          duration: 52,
          topic: script.trim().slice(0, 200),
          quality: 'avatar',
          language: 'en',
          avatar_url: avatarVideoUrl,
          voiceover_url: run.voiceoverUrl,
          ...(run.realAudioDuration != null ? { real_audio_duration: run.realAudioDuration } : {}),
          ...(run.hookSeconds != null ? { avatar_hook_seconds: run.hookSeconds } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok || typeof data?.render_id !== 'string') {
        setError(typeof data?.error === 'string' ? data.error : 'Could not assemble the final video.')
        setPhase('failed')
        return
      }
      setPhase('rendering')
      setProgress(70)
      void pollRender(data.render_id, false)
    } catch {
      setError('Could not assemble the final video.')
      setPhase('failed')
    }
  }

  async function pollRender(renderId: string, deducted: boolean) {
    try {
      const res = await fetch(`/api/compose/status/${encodeURIComponent(renderId)}?deducted=${deducted ? 1 : 0}`, { cache: 'no-store' })
      const data = await res.json()
      if (cancelledRef.current) return
      if (data.phase === 'done' && typeof data.final_video_url === 'string') {
        setFinalUrl(data.final_video_url)
        setProgress(100)
        setPhase('done')
        if (data.creditsDeducted === true) {
          setAvatarCredits((c) => (typeof c === 'number' ? Math.max(0, c - 1) : c))
        }
        try { window.dispatchEvent(new Event('creditsChanged')) } catch {}
        return
      }
      if (data.phase === 'failed') {
        setError(typeof data.error === 'string' ? data.error : 'Render failed. You were not charged.')
        setPhase('failed')
        return
      }
      const nextDeducted = deducted || data.creditsDeducted === true
      setProgress((p) => (typeof data.progress === 'number' ? Math.min(96, 70 + data.progress * 0.26) : Math.min(96, p + 3)))
      setTimeout(() => pollRender(renderId, nextDeducted), 4000)
    } catch {
      setTimeout(() => pollRender(renderId, deducted), 6000)
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────
  const previewSrc = sourceKind === 'video' ? videoUrl : faceUrl

  return (
    <div className="px-4 sm:px-6 py-7 pb-20">
      {/* Header */}
      <div className="mb-7">
        <div className="font-black uppercase tracking-[.18em] mb-2" style={{ fontSize: '0.65rem', color: '#34D399' }}>
          Avatar Studio
        </div>
        <h1 className="font-display font-bold tracking-tight" style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}>
          Your face. Your script. <span className="grad-text">One video.</span>
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted2)' }}>
          Everything you need to make yourself speak — nothing you don’t.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px] items-start" style={{ maxWidth: 1060 }}>
        {/* ── LEFT: controls ── */}
        <div className="flex flex-col gap-5">
          {/* 1 · Source */}
          <section className="neon-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>1 · Who’s talking</h2>
              <div className="flex gap-1.5">
                {(['photo', 'video'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSourceKind(k)}
                    disabled={busy}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-bold"
                    style={{
                      background: sourceKind === k ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                      border: sourceKind === k ? '1px solid rgba(52,211,153,0.5)' : '1px solid var(--border)',
                      color: sourceKind === k ? '#34D399' : 'var(--muted2)',
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {k === 'photo' ? '📷 Photo' : '🎥 Video'} {k === 'video' && <span style={{ fontSize: 8, opacity: 0.85 }}>BETA</span>}
                  </button>
                ))}
              </div>
            </div>

            {sourceKind === 'photo' ? (
              <>
                {savedFaces.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {savedFaces.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFaceUrl(f.url)}
                        disabled={busy}
                        title="Use this saved face"
                        style={{ borderRadius: 999, padding: 2, border: faceUrl === f.url ? '2px solid #34D399' : '2px solid transparent', background: 'none', cursor: 'pointer' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt="Saved face" className="h-11 w-11 rounded-full object-cover" />
                      </button>
                    ))}
                    <span className="text-[11px]" style={{ color: 'var(--muted)' }}>your saved faces</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={busy}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  {faceUrl ? '🖼️ Upload a different photo' : '🖼️ Upload a photo'}
                </button>
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null, 'photo')} />
                <p className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>Sharp, front-facing, one person. JPG/PNG up to 8 MB.</p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={busy}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  {videoUrl ? '🎥 Upload a different video' : '🎥 Upload a short video of you'}
                </button>
                <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null, 'video')} />
                <p className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>
                  10–30s of you facing the camera (talking or not). We re-voice your lips with the script. MP4/MOV up to 40 MB.
                </p>
              </>
            )}

            <label className="flex items-start gap-2 mt-3 cursor-pointer">
              <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5" />
              <span className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                I confirm I have the right to use this person’s image and consent to it being animated by AI.
              </span>
            </label>
            {uploadError && <p className="text-xs mt-2 font-semibold" style={{ color: '#f87171' }} role="alert">⚠️ {uploadError}</p>}
          </section>

          {/* 2 · Script */}
          <section className="neon-card p-5">
            <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted2)' }}>2 · What they say</h2>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              disabled={busy}
              maxLength={5000}
              rows={6}
              placeholder={'Type your script or just the idea — e.g. "3 money habits that made me quit my job"'}
              className="w-full rounded-xl px-3.5 py-3 text-sm leading-relaxed resize-none"
              style={{ background: 'rgba(0,0,0,.3)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', minHeight: 140 }}
            />
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button
                type="button"
                onClick={handleVoicePreview}
                disabled={voiceLoading || busy}
                className="rounded-lg px-3 py-1.5 text-[12px] font-bold"
                style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.3)', color: '#22D3EE', cursor: voiceLoading || busy ? 'not-allowed' : 'pointer' }}
              >
                {voiceLoading ? '🎙️ Generating…' : '🔊 Preview the voice — free'}
              </button>
              {voiceUrl && <audio controls autoPlay src={voiceUrl} style={{ height: 30, maxWidth: 260 }} />}
            </div>
            {voiceError && <p className="text-xs mt-2 font-semibold" style={{ color: '#f87171' }}>{voiceError}</p>}
          </section>

          {/* 3 · Style (photo sources only — video is always full lipsync) */}
          {sourceKind === 'photo' && (
            <section className="neon-card p-5">
              <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted2)' }}>3 · How it looks</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setHookMode(true)}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-[12px] font-bold"
                  style={{ background: hookMode ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)', border: hookMode ? '1px solid rgba(52,211,153,0.5)' : '1px solid var(--border)', color: hookMode ? '#34D399' : 'var(--muted2)', cursor: 'pointer' }}
                >
                  ⚡ Hook intro — you open, b-roll tells the story
                </button>
                <button
                  type="button"
                  onClick={() => setHookMode(false)}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-[12px] font-bold"
                  style={{ background: !hookMode ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)', border: !hookMode ? '1px solid rgba(52,211,153,0.5)' : '1px solid var(--border)', color: !hookMode ? '#34D399' : 'var(--muted2)', cursor: 'pointer' }}
                >
                  🎬 Full video — face the whole time
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => setEngine('fabric')}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-[12px] font-bold"
                  style={{ background: engine === 'fabric' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)', border: engine === 'fabric' ? '1px solid rgba(52,211,153,0.5)' : '1px solid var(--border)', color: engine === 'fabric' ? '#34D399' : 'var(--muted2)', cursor: 'pointer' }}
                >
                  🎙️ Standard — talking head
                </button>
                <button
                  type="button"
                  onClick={() => setEngine('omnihuman')}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-[12px] font-bold"
                  style={{ background: engine === 'omnihuman' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)', border: engine === 'omnihuman' ? '1px solid rgba(52,211,153,0.5)' : '1px solid var(--border)', color: engine === 'omnihuman' ? '#34D399' : 'var(--muted2)', cursor: 'pointer' }}
                >
                  🕺 Pro — body & gestures <span style={{ fontSize: 8 }}>BETA</span>
                </button>
              </div>
            </section>
          )}

          {/* 4 · Generate */}
          <section className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="btn-neon w-full px-6 py-4 text-base disabled:opacity-50"
              style={{ cursor: canGenerate ? 'pointer' : 'not-allowed' }}
            >
              {busy ? 'Working…' : '🎭 Generate my avatar video'}
            </button>
            <p className="text-[12px] text-center" style={{ color: 'var(--muted)' }}>
              1 Avatar Credit · debited only on success ·{' '}
              <span style={{ color: (avatarCredits ?? 0) > 0 ? '#34D399' : '#f87171', fontWeight: 700 }}>
                you have {avatarCredits === null ? '—' : avatarCredits}
              </span>
              {(avatarCredits ?? 1) < 1 && (
                <>
                  {' '}· <Link href="/generate?avatar=1" style={{ color: '#34D399' }}>get credits from $11.90</Link>
                </>
              )}
            </p>
            {!isLoggedIn && (
              <p className="text-[12px] text-center" style={{ color: 'var(--muted2)' }}>
                <Link href="/login?redirect=/avatar" style={{ color: '#34D399', fontWeight: 700 }}>Sign in</Link> to create your avatar video.
              </p>
            )}
            {error && <p className="text-sm font-semibold rounded-xl px-4 py-3" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }} role="alert">⚠️ {error}</p>}
          </section>
        </div>

        {/* ── RIGHT: live phone preview + status ── */}
        <div className="hidden lg:flex flex-col items-center gap-4 sticky top-20">
          <div
            style={{
              width: 250, height: 520, borderRadius: 36, padding: 9,
              background: 'linear-gradient(160deg, #1A1A1D, #0A0A0C)',
              border: '1px solid var(--border2)',
              boxShadow: '0 0 0 5px rgba(8,8,10,0.9), 0 24px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 28, overflow: 'hidden', background: '#0D0D0F' }}>
              {phase === 'done' && finalUrl ? (
                <video src={finalUrl} controls autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : previewSrc ? (
                sourceKind === 'video' ? (
                  <video src={previewSrc} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: busy ? 0.45 : 1 }} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewSrc} alt="Your avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: busy ? 0.45 : 1 }} />
                )
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
                  <span style={{ fontSize: 40 }}>🎭</span>
                  <span className="text-xs font-semibold">Pick a face to preview</span>
                </div>
              )}
              {busy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5" style={{ background: 'rgba(10,10,11,0.55)', backdropFilter: 'blur(2px)' }}>
                  <div className="spinner-sm" style={{ position: 'relative' }}><div className="spinner-sm-inner" /></div>
                  <p className="text-center text-[12px] font-bold" style={{ color: 'var(--text2)' }}>{PHASE_COPY[phase]}</p>
                  <div style={{ width: '85%', height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #10B981, #22D3EE)', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {phase === 'done' && finalUrl && (
            <a
              href={finalUrl}
              download
              className="btn-neon w-full text-center px-5 py-3 text-sm"
              style={{ textDecoration: 'none', maxWidth: 250 }}
            >
              ⬇ Download MP4
            </a>
          )}
          {phase === 'done' && (
            <button
              type="button"
              onClick={() => { setPhase('idle'); setFinalUrl(null); setProgress(0) }}
              className="text-[12px] font-bold"
              style={{ color: 'var(--muted2)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ↺ Make another
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
