'use client'

// AI Avatar (feature/ai-avatar) — "Add a face — Premium" control rendered next
// to the script textarea on /generate. Collapsed: a single premium button.
// Expanded: photo picker + preview + the image-rights checkbox (protection
// rule) + upload. On success the public photo URL is handed to the parent via
// onChange; GenerateClient then routes Generate through /api/generate-avatar.
import { useRef, useState } from 'react'

interface AvatarUploadProps {
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
  /** CP2 — separate avatar-credit balance (null = signed out / unknown). */
  credits?: number | null
  /** CP2 — auto-expand the panel (home button → /generate?avatar=1). */
  initialOpen?: boolean
}

export default function AvatarUpload({ value, onChange, disabled, credits = null, initialOpen = false }: AvatarUploadProps) {
  const [open, setOpen] = useState(initialOpen)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rights, setRights] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function pickFile(f: File | null) {
    setError(null)
    setFile(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

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

  // ── Uploaded state: compact confirmation chip ────────────────────────────
  if (value) {
    return (
      <div
        className="mt-3 flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          maxWidth: 830,
          background: 'rgba(168,85,247,0.08)',
          border: '1px solid rgba(168,85,247,0.45)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Your avatar face"
          className="h-10 w-10 rounded-full object-cover"
          style={{ border: '2px solid rgba(168,85,247,0.6)' }}
        />
        <div className="flex-1">
          <div className="text-sm font-bold" style={{ color: '#d8b4fe' }}>
            🎭 AI Avatar ready
          </div>
          <div className="text-xs" style={{ color: 'var(--muted2)' }}>
            Your video will show this person speaking the script.
          </div>
          {/* CP2 — cost shown BEFORE the render (protection rule from the spec). */}
          <div className="text-[11px] mt-0.5 font-semibold" style={{ color: credits !== null && credits < 1 ? '#fca5a5' : '#c4b5fd' }}>
            Uses 1 Avatar Credit{credits !== null ? ` · you have ${credits}` : ''}
            {credits !== null && credits < 1 ? ' — you’ll be asked to grab a pack' : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          disabled={disabled}
          className="text-xs font-bold px-3 py-1.5 rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Remove
        </button>
      </div>
    )
  }

  // ── Collapsed state: the premium entry button ────────────────────────────
  if (!open) {
    return (
      <div className="mt-3" style={{ maxWidth: 830 }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(99,102,241,0.12))',
            border: '1.5px solid rgba(168,85,247,0.5)',
            color: '#d8b4fe',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <span>🎭</span>
          <span>Add a face — Premium</span>
          <span
            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(168,85,247,0.25)', color: '#e9d5ff' }}
          >
            New
          </span>
        </button>
        <div className="text-xs mt-1.5" style={{ color: 'var(--muted2)' }}>
          Upload a photo and your video shows that person speaking your script — AI talking avatar.
          {credits !== null && (
            <span className="ml-1 font-semibold" style={{ color: '#c4b5fd' }}>
              1 Avatar Credit per video · you have {credits}.
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── Expanded state: picker + rights term + upload ────────────────────────
  return (
    <div
      className="mt-3 rounded-xl p-4"
      style={{
        maxWidth: 830,
        background: 'rgba(168,85,247,0.06)',
        border: '1.5px solid rgba(168,85,247,0.4)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold" style={{ color: '#d8b4fe' }}>
          🎭 AI Avatar — add a face
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-bold"
          style={{ color: 'var(--muted)', cursor: 'pointer' }}
        >
          ✕ Close
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      <div className="flex items-center gap-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected face preview"
            className="h-16 w-16 rounded-full object-cover"
            style={{ border: '2px solid rgba(168,85,247,0.6)' }}
          />
        ) : (
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center text-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--border)' }}
          >
            🙂
          </div>
        )}
        <div className="flex-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-sm font-bold px-4 py-2 rounded-lg"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {file ? 'Change photo' : 'Choose photo'}
          </button>
          <div className="text-xs mt-1.5" style={{ color: 'var(--muted2)' }}>
            JPG or PNG, max 8 MB. One sharp, front-facing face works best.
          </div>
        </div>
      </div>

      {/* Image-rights term — required (protection rule) */}
      <label className="flex items-start gap-2 mt-4 cursor-pointer">
        <input
          type="checkbox"
          checked={rights}
          onChange={(e) => setRights(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
          I confirm I have the right to use this person&apos;s image and consent to it being
          animated by AI for this video.
        </span>
      </label>

      {error && (
        <div className="text-xs mt-3 font-semibold" style={{ color: '#fca5a5' }}>
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!file || !rights || uploading}
        onClick={handleUpload}
        className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
        style={{
          background: !file || !rights || uploading
            ? 'rgba(255,255,255,0.06)'
            : 'linear-gradient(135deg, #a855f7, #6366f1)',
          color: !file || !rights || uploading ? 'var(--muted)' : '#fff',
          border: 'none',
          cursor: !file || !rights || uploading ? 'not-allowed' : 'pointer',
        }}
      >
        {uploading ? 'Uploading…' : 'Use this face'}
      </button>
    </div>
  )
}
