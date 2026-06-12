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
}

const MAX_BYTES = 8 * 1024 * 1024

export default function AvatarUpload({ value, onChange, disabled, credits = null, initialOpen = false, onPendingChange, openSignal = 0 }: AvatarUploadProps) {
  const [open, setOpen] = useState(initialOpen)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rights, setRights] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
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
        background: credits < 1 ? 'rgba(248,113,113,0.15)' : 'rgba(168,85,247,0.18)',
        color: credits < 1 ? '#fca5a5' : '#e9d5ff',
        border: `1px solid ${credits < 1 ? 'rgba(248,113,113,0.4)' : 'rgba(168,85,247,0.4)'}`,
      }}
    >
      1 Avatar Credit · 720p{credits !== null ? ` · you have ${credits}` : ''}
    </span>
  ) : (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(168,85,247,0.18)', color: '#e9d5ff', border: '1px solid rgba(168,85,247,0.4)' }}
    >
      1 Avatar Credit · 720p
    </span>
  )

  // ── Uploaded state: compact confirmation chip ────────────────────────────
  if (value) {
    return (
      <div
        className="mt-3 flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ maxWidth: 830, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.45)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Your avatar face"
          className="h-11 w-11 rounded-full object-cover"
          style={{ border: '2px solid rgba(168,85,247,0.6)' }}
        />
        <div className="flex-1">
          <div className="text-sm font-bold" style={{ color: '#d8b4fe' }}>🎭 AI Avatar ready</div>
          <div className="text-xs" style={{ color: 'var(--muted2)' }}>
            Your video will show this person speaking the script.
          </div>
          <div className="mt-1">{creditPill}</div>
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
              <span className="text-sm font-black" style={{ color: '#e9d5ff' }}>🎭 Add a face — AI Avatar</span>
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.3)', color: '#f3e8ff' }}>New</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>
              Upload a photo and your video shows that person <b style={{ color: '#c4b5fd' }}>speaking your script</b>.
            </div>
            <div className="mt-1.5">{creditPill}</div>
          </div>
          <span className="shrink-0 text-lg font-bold transition-transform group-hover:translate-x-0.5" style={{ color: '#d8b4fe' }}>→</span>
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
            background: linear-gradient(135deg, rgba(168,85,247,0.14), rgba(99,102,241,0.14));
            border: 1.5px solid transparent;
            background-clip: padding-box;
            position: relative;
          }
          .sfa-entry::before {
            content: '';
            position: absolute; inset: 0; border-radius: 16px; padding: 1.5px;
            background: linear-gradient(135deg, rgba(168,85,247,0.7), rgba(99,102,241,0.5), rgba(168,85,247,0.7));
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
      style={{ maxWidth: 830, background: 'rgba(168,85,247,0.06)', border: '1.5px solid rgba(168,85,247,0.4)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: '#d8b4fe' }}>
          <AvatarDemoLoop size={28} />
          AI Avatar — add a face
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold" style={{ color: 'var(--muted)', cursor: 'pointer' }}>✕ Close</button>
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
      {/* Mobile: opens the front camera directly */}
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="flex items-center gap-4 rounded-xl p-3 transition-colors"
        style={{ border: `1.5px dashed ${dragging ? 'rgba(168,85,247,0.9)' : 'var(--border)'}`, background: dragging ? 'rgba(168,85,247,0.1)' : 'transparent' }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Selected face preview" className="h-16 w-16 rounded-full object-cover" style={{ border: '2px solid rgba(168,85,247,0.6)' }} />
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
          background: !file || !rights || uploading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #a855f7, #6366f1)',
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
