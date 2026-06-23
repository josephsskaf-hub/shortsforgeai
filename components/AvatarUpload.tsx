'use client'

// AI Avatar — "Add a face" control on /generate (feature/ai-avatar, Nível 2).
// Collapsed: a premium entry card with the live mini-demo so users SEE the
// feature. Expanded: drag-and-drop / paste / choose / take-a-selfie picker +
// preview + image-rights term + a staged upload button that surfaces the
// server-side face check. On success the public photo URL is handed up via
// onChange; GenerateClient then routes Generate through /api/generate-avatar.
import { useEffect, useRef, useState } from 'react'
import AvatarDemoLoop from '@/components/AvatarDemoLoop'
import AvatarHowItWorks from '@/components/AvatarHowItWorks'

interface AvatarUploadProps {
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
  /** CP2 — separate avatar-credit balance (null = signed out / unknown). */
  credits?: number | null
  /** CP2 — auto-expand the panel (home button → /generate?avatar=1). */
  initialOpen?: boolean
  /** Bug 12/06 — tells the parent a photo is picked but NOT attached yet
   *  ("Use this face" not pressed). GenerateClient blocks Generate on it so a
   *  half-finished avatar never silently renders a faceless video. */
  onPendingChange?: (pending: boolean) => void
  /** Bug 12/06 — increment to force the panel open (used by the Generate
   *  guard to bring the user back to the unfinished avatar step). */
  openSignal?: number
  /** Face-app wave 1 — last approved face from the profile (avatar library).
   *  Enables the one-click "Use my saved face" flow (consent was already
   *  confirmed when this photo was first uploaded). */
  savedFaceUrl?: string | null
  /** Face-app wave 1 — avatar engine: 'fabric' (talking head, default) or
   *  'omnihuman' (full-figure body & gestures, Pro tier). */
  engine?: 'fabric' | 'omnihuman'
  onEngineChange?: (engine: 'fabric' | 'omnihuman') => void
  /** Face-app wave 1 — Hook Avatar: true = face speaks only the first ~8s,
   *  b-roll carries the rest (recommended/default). false = full-video face. */
  hookMode?: boolean
  onHookModeChange?: (hook: boolean) => void
  /** Face-app wave 1 — FREE voice preview (dryRun TTS) before spending a
   *  credit. Parent owns the fetch; this component renders button + player. */
  onPreviewVoice?: () => void
  voicePreviewLoading?: boolean
  voicePreviewUrl?: string | null
  voicePreviewError?: string | null
}

const MAX_BYTES = 8 * 1024 * 1024

export default function AvatarUpload({ value, onChange, disabled, credits = null, initialOpen = false, onPendingChange, openSignal = 0, savedFaceUrl = null, engine = 'fabric', onEngineChange, hookMode = true, onHookModeChange, onPreviewVoice, voicePreviewLoading = false, voicePreviewUrl = null, voicePreviewError = null }: AvatarUploadProps) {
  const [open, setOpen] = useState(initialOpen)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rights, setRights] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Face-app wave 1 — non-blocking photo-quality warning (client pre-check).
  const [warning, setWarning] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [howOpen, setHowOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const cameraRef = useRef<HTMLInputElement | null>(null)

  // Clean up object URLs to avoid leaks.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  // Bug 12/06 — surface "photo picked but not attached" to the parent.
  useEffect(() => {
    onPendingChange?.(!!file && !value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, value])

  // Bug 12/06 — parent can force the panel open (Generate guard).
  useEffect(() => {
    if (openSignal > 0) setOpen(true)
  }, [openSignal])

  function pickFile(f: File | null) {
    setError(null)
    setWarning(null)
    if (f) {
      if (!/^image\/(jpe?g|png)$/i.test(f.type)) {
        setError('Please use a JPG or PNG photo.')
        return
      }
      if (f.size > MAX_BYTES) {
        setError('Photo is too large — max 8 MB.')
        return
      }
    }
    setFile(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const nextUrl = f ? URL.createObjectURL(f) : null
    setPreviewUrl(nextUrl)
    if (f && nextUrl) void precheckPhoto(nextUrl)
  }

  // Face-app wave 1 — client-side pre-check. Catches the obvious problems
  // (tiny photo, no detectable front-facing face) BEFORE the upload + server
  // vision check, with instant feedback. Non-blocking: warnings only — the
  // server check stays the authority, and FaceDetector isn't in every browser.
  async function precheckPhoto(objectUrl: string) {
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('img load failed'))
        img.src = objectUrl
      })
      if (img.naturalWidth < 400 || img.naturalHeight < 400) {
        setWarning('This photo is quite small — a sharper photo (at least 400×400) gives a much better avatar.')
        return
      }
      // FaceDetector is Chrome/Edge-only; skip silently elsewhere.
      const FD = (window as unknown as { FaceDetector?: new (opts?: { maxDetectedFaces?: number }) => { detect: (i: HTMLImageElement) => Promise<unknown[]> } }).FaceDetector
      if (FD) {
        const faces = await new FD({ maxDetectedFaces: 2 }).detect(img)
        if (faces.length === 0) {
          setWarning('We couldn’t spot a clear face in this photo. A sharp, front-facing photo (looking at the camera) works best — this one may be rejected.')
        } else if (faces.length > 1) {
          setWarning('Looks like there’s more than one face here. Use a photo with exactly one person for the best result.')
        }
      }
    } catch {
      // Pre-check is best-effort only — never block on it.
    }
  }

  // Face-app wave 1 — one-click reuse of the profile's approved face. Consent
  // was confirmed when this photo was originally uploaded and face-checked.
  function useSavedFace() {
    if (!savedFaceUrl || disabled) return
    setError(null)
    setWarning(null)
    onChange(savedFaceUrl)
    setOpen(false)
  }

  // Paste-an-image support while the panel is open.
  useEffect(() => {
    if (!open) return
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      const f = item?.getAsFile()
      if (f) pickFile(f)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleUpload() {
    if (!file || !rights || uploading) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('rights', 'true')
      const res = await fetch('/api/avatar/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Upload failed. Please try again.')
        return
      }
      if (typeof data?.url !== 'string' || !data.url) {
        setError('Upload failed. Please try again.')
        return
      }
      onChange(data.url)
      setOpen(false)
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    onChange(null)
    pickFile(null)
    setRights(false)
    setOpen(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  const creditPill = credits !== null ? (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{
        background: credits < 1 ? 'rgba(248,113,113,0.15)' : 'rgba(139,92,246,0.18)',
        color: credits < 1 ? '#fca5a5' : '#a7f3d0',
        border: `1px solid ${credits < 1 ? 'rgba(248,113,113,0.4)' : 'rgba(139,92,246,0.4)'}`,
      }}
    >
      1 Avatar Credit · 720p{credits !== null ? ` · you have ${credits}` : ''}
    </span>
  ) : (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(139,92,246,0.18)', color: '#a7f3d0', border: '1px solid rgba(139,92,246,0.4)' }}
    >
      1 Avatar Credit · 720p
    </span>
  )

  // Face-app wave 1 — engine selector, shared by the attached chip and the
  // expanded panel. 'fabric' = talking head; 'omnihuman' = body & gestures.
  const enginePicker = onEngineChange ? (
    <div className="flex flex-wrap gap-2 mt-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onEngineChange('fabric')}
        className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
        style={{
          background: engine === 'fabric' ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
          border: engine === 'fabric' ? '1.5px solid rgba(139,92,246,0.7)' : '1px solid var(--border)',
          color: engine === 'fabric' ? '#a7f3d0' : 'var(--muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        🎙️ Standard — talking head
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onEngineChange('omnihuman')}
        className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
        style={{
          background: engine === 'omnihuman' ? 'rgba(167,139,250,0.22)' : 'rgba(255,255,255,0.05)',
          border: engine === 'omnihuman' ? '1.5px solid rgba(167,139,250,0.7)' : '1px solid var(--border)',
          color: engine === 'omnihuman' ? '#a7f3d0' : 'var(--muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        🕺 Pro — body &amp; gestures <span className="font-black" style={{ fontSize: 9, opacity: 0.9 }}>BETA</span>
      </button>
    </div>
  ) : null

  // Face-app wave 1 — Hook vs Full coverage picker. Hook (default) = the face
  // opens the video for ~8s, then b-roll carries the story.
  const modePicker = onHookModeChange ? (
    <div className="flex flex-wrap gap-2 mt-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onHookModeChange(true)}
        className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
        style={{
          background: hookMode ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.05)',
          border: hookMode ? '1.5px solid rgba(34,197,94,0.6)' : '1px solid var(--border)',
          color: hookMode ? '#bbf7d0' : 'var(--muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        ⚡ Hook intro — face opens, b-roll tells the story <span className="font-black" style={{ fontSize: 9, opacity: 0.9 }}>RECOMMENDED</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onHookModeChange(false)}
        className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
        style={{
          background: !hookMode ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
          border: !hookMode ? '1.5px solid rgba(139,92,246,0.7)' : '1px solid var(--border)',
          color: !hookMode ? '#a7f3d0' : 'var(--muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        🎬 Full video — face on screen the whole time
      </button>
    </div>
  ) : null

  // Face-app wave 1 — free voice preview button + inline player. Lives in the
  // attached chip so the user hears the narration BEFORE spending a credit.
  const voicePreview = onPreviewVoice ? (
    <div className="mt-2">
      <button
        type="button"
        disabled={disabled || voicePreviewLoading}
        onClick={onPreviewVoice}
        className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
        style={{
          background: 'rgba(20,184,166,0.18)',
          border: '1px solid rgba(20,184,166,0.5)',
          color: '#c7d2fe',
          cursor: disabled || voicePreviewLoading ? 'not-allowed' : 'pointer',
        }}
      >
        {voicePreviewLoading ? '🎙️ Generating voice…' : '🔊 Preview the voice — free'}
      </button>
      {voicePreviewUrl && (
        <audio controls autoPlay src={voicePreviewUrl} className="mt-2 w-full" style={{ maxWidth: 420, height: 32 }} />
      )}
      {voicePreviewError && (
        <div className="text-[11px] mt-1.5 font-semibold" style={{ color: '#fca5a5' }}>{voicePreviewError}</div>
      )}
    </div>
  ) : null

  // ── Uploaded state: compact confirmation chip ────────────────────────────
  if (value) {
    return (
      <div
        className="mt-3 flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ maxWidth: 830, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.45)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Your avatar face"
          className="h-11 w-11 rounded-full object-cover"
          style={{ border: '2px solid rgba(139,92,246,0.6)' }}
        />
        <div className="flex-1">
          <div className="text-sm font-bold" style={{ color: '#c4b5fd' }}>🎭 AI Avatar ready</div>
          <div className="text-xs" style={{ color: 'var(--muted2)' }}>
            {hookMode
              ? 'This person opens the video speaking the hook (~8s); b-roll covers the rest.'
              : engine === 'omnihuman'
                ? 'Your video will show this person speaking — with body movement and gestures.'
                : 'Your video will show this person speaking the script.'}
          </div>
          <div className="mt-1">{creditPill}</div>
          {modePicker}
          {enginePicker}
          {voicePreview}
        </div>
        <button
          type="button"
          onClick={handleRemove}
          disabled={disabled}
          className="text-xs font-bold px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          Remove
        </button>
      </div>
    )
  }

  // ── Collapsed state: premium entry card with the live mini-demo ──────────
  if (!open) {
    return (
      <div className="mt-3" style={{ maxWidth: 830 }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="sfa-entry group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          <AvatarDemoLoop size={52} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black" style={{ color: '#a7f3d0' }}>🎭 Add a face — AI Avatar</span>
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.3)', color: '#d1fae5' }}>New</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>
              Upload a photo and your video shows that person <b style={{ color: '#c4b5fd' }}>speaking your script</b>.
            </div>
            <div className="mt-1.5">{creditPill}</div>
          </div>
          <span className="shrink-0 text-lg font-bold transition-transform group-hover:translate-x-0.5" style={{ color: '#c4b5fd' }}>→</span>
        </button>
        <button
          type="button"
          onClick={() => setHowOpen(true)}
          className="mt-1.5 text-[11px] font-semibold underline"
          style={{ color: 'var(--muted2)', cursor: 'pointer', background: 'none', border: 'none' }}
        >
          See how it works →
        </button>
        <AvatarHowItWorks open={howOpen} onClose={() => setHowOpen(false)} />
        <style jsx>{`
          .sfa-entry {
            background: linear-gradient(135deg, rgba(139,92,246,0.14), rgba(20,184,166,0.14));
            border: 1.5px solid transparent;
            background-clip: padding-box;
            position: relative;
          }
          .sfa-entry::before {
            content: '';
            position: absolute; inset: 0; border-radius: 16px; padding: 1.5px;
            background: linear-gradient(135deg, rgba(139,92,246,0.7), rgba(20,184,166,0.5), rgba(139,92,246,0.7));
            background-size: 200% 200%;
            -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            -webkit-mask-composite: xor; mask-composite: exclude;
            animation: sfaBorder 4s linear infinite;
            pointer-events: none;
          }
          .sfa-entry:hover { transform: translateY(-1px); }
          @keyframes sfaBorder { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
          @media (prefers-reduced-motion: reduce) { .sfa-entry::before { animation: none; } }
        `}</style>
      </div>
    )
  }

  // ── Expanded state: drag/drop/paste/selfie picker + rights + upload ──────
  return (
    <div
      className="mt-3 rounded-2xl p-4"
      style={{ maxWidth: 830, background: 'rgba(139,92,246,0.06)', border: '1.5px solid rgba(139,92,246,0.4)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: '#c4b5fd' }}>
          <AvatarDemoLoop size={28} />
          AI Avatar — add a face
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold" style={{ color: 'var(--muted)', cursor: 'pointer' }}>✕ Close</button>
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
      {/* Mobile: opens the front camera directly */}
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />

      {/* Face-app wave 1 — avatar library: one-click reuse of the approved face */}
      {savedFaceUrl && !file && (
        <button
          type="button"
          onClick={useSavedFace}
          disabled={disabled}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 mb-3 text-left transition-all"
          style={{ background: 'rgba(139,92,246,0.1)', border: '1.5px solid rgba(139,92,246,0.5)', cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={savedFaceUrl} alt="Your saved face" className="h-10 w-10 rounded-full object-cover" style={{ border: '2px solid rgba(139,92,246,0.6)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold" style={{ color: '#a7f3d0' }}>⚡ Use my saved face</div>
            <div className="text-[11px]" style={{ color: 'var(--muted2)' }}>Your last approved photo — one click, no re-upload.</div>
          </div>
          <span className="text-sm font-bold" style={{ color: '#c4b5fd' }}>→</span>
        </button>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="flex items-center gap-4 rounded-xl p-3 transition-colors"
        style={{ border: `1.5px dashed ${dragging ? 'rgba(139,92,246,0.9)' : 'var(--border)'}`, background: dragging ? 'rgba(139,92,246,0.1)' : 'transparent' }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Selected face preview" className="h-16 w-16 rounded-full object-cover" style={{ border: '2px solid rgba(139,92,246,0.6)' }} />
        ) : (
          <div className="h-16 w-16 rounded-full flex items-center justify-center text-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--border)' }}>🙂</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="text-xs font-bold px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
              {file ? '🖼️ Change photo' : '🖼️ Choose photo'}
            </button>
            <button type="button" onClick={() => cameraRef.current?.click()} className="text-xs font-bold px-3 py-2 rounded-lg sm:hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
              📸 Take a selfie
            </button>
          </div>
          <div className="text-xs mt-1.5" style={{ color: 'var(--muted2)' }}>
            <span className="hidden sm:inline">Drag &amp; drop, paste, or </span>pick a sharp, front-facing photo. JPG/PNG, max 8 MB.
          </div>
        </div>
      </div>

      {/* Image-rights term — required (protection rule). UX 12/06: once a
          photo is picked, the unchecked box becomes the ONLY blocker — pulse
          it amber so nobody misses why the button is disabled. */}
      <label
        className="flex items-start gap-2 mt-4 cursor-pointer rounded-lg p-2 transition-colors"
        style={{
          background: file && !rights ? 'rgba(251,191,36,0.08)' : 'transparent',
          border: file && !rights ? '1px solid rgba(251,191,36,0.5)' : '1px solid transparent',
        }}
      >
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5" />
        <span className="text-xs leading-relaxed" style={{ color: file && !rights ? '#fde68a' : 'var(--muted)' }}>
          I confirm I have the right to use this person&apos;s image and consent to it being animated by AI for this video.
        </span>
      </label>

      {/* Face-app wave 1 — engine choice lives with the upload step */}
      {enginePicker && (
        <div className="mt-4">
          <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Avatar engine</div>
          {enginePicker}
        </div>
      )}

      {warning && !error && (
        <div
          className="text-xs mt-3 font-semibold rounded-lg px-3 py-2"
          style={{ color: '#fde68a', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.4)' }}
        >
          💡 {warning}
        </div>
      )}

      {error && (
        <div
          className="text-xs mt-3 font-semibold rounded-lg px-3 py-2"
          style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)' }}
          role="alert"
        >
          ⚠️ {error}
        </div>
      )}

      <button
        type="button"
        disabled={!file || !rights || uploading}
        onClick={handleUpload}
        className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
        style={{
          background: !file || !rights || uploading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #8b5cf6, #14b8a6)',
          color: !file || !rights || uploading ? 'var(--muted)' : '#fff',
          border: 'none',
          cursor: !file || !rights || uploading ? 'not-allowed' : 'pointer',
        }}
      >
        {uploading
          ? '🔍 Checking your photo…'
          : !file
            ? '🖼️ Choose a photo first'
            : !rights
              ? '☝️ Check the consent box to continue'
              : 'Use this face ✓'}
      </button>
      {file && rights && !uploading && (
        <div className="text-[11px] mt-2 font-semibold" style={{ color: '#c4b5fd' }}>
          One more click — your face isn&apos;t attached to the video until you press this.
        </div>
      )}
    </div>
  )
}
