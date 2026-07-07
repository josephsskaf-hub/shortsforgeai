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
import { createClient } from '@/lib/supabase/client'

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

// The browser records webm/opus, which MiniMax voice-clone rejects. Decode it
// and re-encode as a mono 16-bit WAV (a format MiniMax accepts) client-side.
function encodeWavMono(buffer: AudioBuffer): Blob {
  const len = buffer.length
  const sampleRate = buffer.sampleRate
  const numCh = buffer.numberOfChannels
  const mono = new Float32Array(len)
  for (let ch = 0; ch < numCh; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < len; i++) mono[i] += data[i] / numCh
  }
  const out = new ArrayBuffer(44 + len * 2)
  const view = new DataView(out)
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + len * 2, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  writeStr(36, 'data'); view.setUint32(40, len * 2, true)
  let off = 44
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return new Blob([out], { type: 'audio/wav' })
}

async function webmBlobToWav(blob: Blob): Promise<Blob> {
  const arrayBuf = await blob.arrayBuffer()
  const Ctx: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  try {
    const audioBuf = await ctx.decodeAudioData(arrayBuf)
    return encodeWavMono(audioBuf)
  } finally {
    void ctx.close()
  }
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
  // Verbatim fix (13/06) — 'verbatim' speaks EXACTLY the typed text (no GPT
  // expansion / no 45s padding); 'expand' turns an idea into a full Short
  // script. Auto-suggested from length until the user picks manually.
  const [scriptMode, setScriptMode] = useState<'verbatim' | 'expand'>('verbatim')
  // 13/06 — narração em EN/PT/ES (o backend já suportava; o Studio mandava 'en' fixo).
  const [language, setLanguage] = useState<'en' | 'pt' | 'es'>('en')
  // Scene mode (16/06) — describe a scene; FLUX Kontext edits the face photo
  // into it (same face, new outfit/background), then OmniHuman animates it.
  const [scenePrompt, setScenePrompt] = useState('')
  const [sceneImageUrl, setSceneImageUrl] = useState<string | null>(null)
  const [sceneLoading, setSceneLoading] = useState(false)
  const [sceneError, setSceneError] = useState<string | null>(null)
  // Realism (16/06) — 'real' animates the REAL photo directly (max fidelity,
  // no face distortion on movement); 'scene' puts the person in a generated
  // scene (more context, softer face). Default 'real' — that's the lifelike one.
  const [fidelity, setFidelity] = useState<'real' | 'scene'>('real')
  // Voice cloning (16/06) — clone the user's voice from a sample; the narration
  // then speaks in that voice instead of a default one.
  const [voiceId, setVoiceId] = useState<string | null>(null)
  const [voiceCloning, setVoiceCloning] = useState(false)
  const [voiceCloneError, setVoiceCloneError] = useState<string | null>(null)
  const voiceInputRef = useRef<HTMLInputElement | null>(null)
  // In-browser voice recorder (record a sample instead of uploading a file).
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordStartRef = useRef<number | null>(null)
  const userPickedModeRef = useRef(false)
  const scriptWords = script.trim() ? script.trim().split(/\s+/).length : 0

  useEffect(() => {
    if (userPickedModeRef.current) return
    setScriptMode(scriptWords > 0 && scriptWords < 25 ? 'verbatim' : scriptWords === 0 ? 'verbatim' : 'expand')
  }, [scriptWords])

  // Verbatim renders are as long as the words actually take (~2.4 w/s);
  // expanded scripts target the locked Shorts window.
  const requestDuration = scriptMode === 'verbatim'
    ? Math.min(90, Math.max(5, Math.round(scriptWords / 2.4)))
    : 52

  // ── Voice preview (free dryRun) ───────────────────────────────────────
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  // ── Credits + run state ───────────────────────────────────────────────
  // KINEO-AVATAR-120-2026-07-06 — this now holds the UNIVERSAL video_credits
  // balance (avatar costs 120 of these, was the separate avatar_credits @ 1).
  // Kept the variable name to minimize churn; it reads `credits` from /api/credits.
  // KINEO-AVATAR-220-2026-07-07 — repriced 120→220 (real VEED cost ~$9.60/video → ~47% margem Creator)
  const AVATAR_COST = 220
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
      // KINEO-AVATAR-120-2026-07-06 — read the UNIVERSAL balance (`credits`),
      // not the retired `avatarCredits` add-on.
      .then((d) => setAvatarCredits(typeof d?.credits === 'number' ? d.credits : 0))
      .catch(() => {})
    return () => { cancelledRef.current = true }
  }, [isLoggedIn])

  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'failed'
  const sourceReady = sourceKind === 'photo' ? !!faceUrl : !!videoUrl
  const canGenerate = isLoggedIn && sourceReady && script.trim().length > 0 && !busy

  // Warn before a refresh/close while a render is running — the job is still
  // processing and leaving abandons it. (Note: also reminds the user not to
  // click away to another page mid-render, which restarts the flow.)
  useEffect(() => {
    if (!busy) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [busy])

  // Fix 12/06 — Vercel functions reject bodies over ~4.5MB BEFORE our code
  // runs, so a modern camera photo (6-12MB) failed with a generic error.
  // Compress client-side: downscale to ≤1280px and re-encode as JPEG ~0.85.
  // Any phone photo lands around 200-400KB with no visible quality loss.
  async function compressPhoto(file: File): Promise<File> {
    if (file.size < 2 * 1024 * 1024) return file // small enough — keep as-is
    try {
      const bitmap = await createImageBitmap(file)
      const maxSide = 1280
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      const w = Math.round(bitmap.width * scale)
      const h = Math.round(bitmap.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      ctx.drawImage(bitmap, 0, 0, w, h)
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      if (!blob) return file
      return new File([blob], 'face.jpg', { type: 'image/jpeg' })
    } catch {
      return file // compression is best-effort — server still validates size
    }
  }

  // ── Upload (photo or video) ───────────────────────────────────────────
  async function handleFile(rawFile: File | null, kind: 'photo' | 'video') {
    if (!rawFile) return
    setUploadError(null)
    if (!rights) {
      setUploadError('Please confirm you have the right to use this person’s image first (checkbox below).')
      return
    }
    setPhase('uploading')
    try {
      // iPhone HEIC/HEIF → JPEG. Browsers (desktop) can't decode HEIC, and the
      // vision face-check + avatar engines need JPEG/PNG — so convert BEFORE
      // upload. Most users are on iPhone; rejecting HEIC loses them at the most
      // critical step. Dynamic import keeps the ~1.4MB decoder out of the main
      // bundle (loaded only when an actual HEIC is picked).
      let photoSrc = rawFile
      if (kind === 'photo' && (/hei[cf]/i.test(rawFile.type) || /\.hei[cf]$/i.test(rawFile.name))) {
        try {
          const heic2any = (await import('heic2any')).default
          const converted = await heic2any({ blob: rawFile, toType: 'image/jpeg', quality: 0.9 })
          const blob = Array.isArray(converted) ? converted[0] : converted
          photoSrc = new File([blob], 'face.jpg', { type: 'image/jpeg' })
        } catch {
          setUploadError('Could not read this iPhone (HEIC) photo. Please try another, or a JPG/PNG.')
          setPhase('idle')
          return
        }
      }
      const file = kind === 'photo' ? await compressPhoto(photoSrc) : rawFile

      // Direct-to-storage (13/06) — videos skip Vercel entirely: a signed
      // upload URL streams the file straight to Supabase Storage, so the
      // real limit is the bucket's 40MB (~60s at 720p), not Vercel's 4.5MB.
      if (kind === 'video') {
        if (file.size > 40 * 1024 * 1024) {
          setUploadError('Video is too large — max 40 MB (~60s at 720p). Tip: export at 720p.')
          setPhase('idle')
          return
        }
        const urlRes = await fetch('/api/avatar/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentType: file.type || 'video/mp4' }),
        })
        const urlData = await urlRes.json().catch(() => ({}))
        if (!urlRes.ok || typeof urlData?.token !== 'string' || typeof urlData?.path !== 'string') {
          setUploadError(typeof urlData?.error === 'string' ? urlData.error : 'Could not prepare the upload. Please try again.')
          setPhase('idle')
          return
        }
        const sb = createClient()
        const { error: upErr } = await sb.storage
          .from('avatars')
          .uploadToSignedUrl(urlData.path, urlData.token, file, { contentType: file.type || 'video/mp4' })
        if (upErr) {
          setUploadError(`Upload failed: ${upErr.message}. Please try again.`)
          setPhase('idle')
          return
        }
        setVideoUrl(urlData.publicUrl as string)
        setSourceKind('video')
        setPhase('idle')
        return
      }

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
      // (videos returned early above via direct-to-storage — this is photo-only)
      setFaceUrl(data.url)
      setSourceKind('photo')
      setSavedFaces((prev) => [{ id: data.url, url: data.url, created_at: new Date().toISOString() }, ...prev].slice(0, 6))
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
        body: JSON.stringify({ prompt: trimmed, duration: requestDuration, language, dryRun: true, scriptMode, ...(voiceId ? { voiceId } : {}) }),
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

  // ── Scene builder: face photo + prompt → a new image of the same person in
  // the described scene (FLUX Kontext), re-hosted on our storage. The result
  // becomes the source the avatar engine animates. Auto-switches to the Pro
  // (body & gestures) engine since scenes are full-figure by nature.
  async function handleBuildScene() {
    if (sceneLoading) return
    if (!faceUrl) { setSceneError('Upload a photo first.'); return }
    const desc = scenePrompt.trim()
    if (!desc) { setSceneError('Describe the scene first.'); return }
    setSceneLoading(true)
    setSceneError(null)
    try {
      const res = await fetch('/api/avatar/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: faceUrl, prompt: desc }),
      })
      const data = await res.json()
      if (!res.ok || typeof data?.url !== 'string') {
        setSceneError(typeof data?.error === 'string' ? data.error : 'Could not build the scene. Try again.')
        return
      }
      setSceneImageUrl(data.url)
      setEngine('omnihuman')
    } catch {
      setSceneError('Could not build the scene. Try again.')
    } finally {
      setSceneLoading(false)
    }
  }

  // ── Voice clone: upload a ~30-60s sample → MiniMax clones it → narration
  // (and the free preview) speaks in that voice.
  async function handleVoiceClone(file: File | null) {
    if (!file || voiceCloning) return
    if (file.size > 12 * 1024 * 1024) { setVoiceCloneError('Audio too large — keep it under 12 MB (~1-2 min).'); return }
    setVoiceCloning(true)
    setVoiceCloneError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/avatar/voice', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || typeof data?.voiceId !== 'string') {
        setVoiceCloneError(typeof data?.error === 'string' ? data.error : 'Could not clone the voice. Try a clearer sample.')
        return
      }
      setVoiceId(data.voiceId)
    } catch {
      setVoiceCloneError('Could not clone the voice. Try again.')
    } finally {
      setVoiceCloning(false)
    }
  }

  // Record a voice sample in the browser, then clone it on stop.
  async function startRecording() {
    if (recording || voiceCloning) return
    setVoiceCloneError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      recordedChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const elapsed = (Date.now() - (recordStartRef.current ?? Date.now())) / 1000
        if (elapsed < 10) { setVoiceCloneError('Recording too short — record at least 15 seconds.'); return }
        try {
          const wav = await webmBlobToWav(new Blob(recordedChunksRef.current, { type: 'audio/webm' }))
          void handleVoiceClone(new File([wav], 'voice.wav', { type: 'audio/wav' }))
        } catch {
          setVoiceCloneError('Could not process the recording. Try uploading an MP3 instead.')
        }
      }
      mediaRecorderRef.current = mr
      recordStartRef.current = Date.now()
      mr.start()
      setRecording(true)
    } catch {
      setVoiceCloneError('Could not access the microphone. Allow mic access, or upload a file instead.')
    }
  }
  function stopRecording() {
    if (!recording) return
    try { mediaRecorderRef.current?.stop() } catch {}
    setRecording(false)
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
          duration: requestDuration,
          language,
          scriptMode,
          ...(voiceId ? { voiceId } : {}),
          ...((fidelity === 'real' || sceneImageUrl) ? { noBroll: true } : {}),
          ...(sourceKind === 'video'
            ? { avatarSourceVideoUrl: videoUrl }
            : { avatarImageUrl: fidelity === 'scene' ? (sceneImageUrl ?? faceUrl) : faceUrl, engine }),
          // Hook mode only makes sense for expanded scripts — a 10s verbatim
          // line IS the hook.
          avatarMode: sourceKind === 'photo' && hookMode && scriptMode === 'expand' ? 'hook' : 'full',
        }),
      })
      const data = await res.json()
      if (res.status === 402) {
        // KINEO-AVATAR-120-2026-07-06 — universal-credit wall (120 credits).
        setError(typeof data?.error === 'string'
          ? data.error
          : `Avatar videos cost ${AVATAR_COST} credits — you’re short. Credits are debited only when your video succeeds.`)
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
          // Tail fix (13/06) — real audio length drives compose; this is just
          // the fallback, so never send a 52s fallback for a 5s verbatim line.
          duration: run.realAudioDuration != null ? Math.max(3, Math.ceil(run.realAudioDuration)) : requestDuration,
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
          // KINEO-AVATAR-120-2026-07-06 — 120 universal credits per avatar video.
          setAvatarCredits((c) => (typeof c === 'number' ? Math.max(0, c - AVATAR_COST) : c))
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
  const previewSrc = (fidelity === 'scene' && sceneImageUrl) ? sceneImageUrl : (sourceKind === 'video' ? videoUrl : faceUrl)

  return (
    <div className="px-4 sm:px-6 py-7 pb-20">
      {/* Header */}
      <div className="mb-7">
        <div className="font-black uppercase tracking-[.18em] mb-2" style={{ fontSize: '0.65rem', color: '#2997ff' }}>
          Avatar Studio
        </div>
        <h1 className="font-display font-bold tracking-tight" style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}>
          Your face. Your script. <span className="grad-text">One video.</span>
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted2)' }}>
          Everything you need to make yourself speak — nothing you don’t.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_480px] items-start" style={{ maxWidth: 1480 }}>
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
                      background: sourceKind === k ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)',
                      border: sourceKind === k ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)',
                      color: sourceKind === k ? '#2997ff' : 'var(--muted2)',
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
                        aria-label="Use this saved face"
                        style={{ borderRadius: 999, padding: 2, border: faceUrl === f.url ? '2px solid #2997ff' : '2px solid transparent', background: 'none', cursor: 'pointer' }}
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
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null, 'photo')} />
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
                  10–60s of you facing the camera (talking or not). We re-voice your lips with the script. MP4/MOV up to 40 MB — 720p export recommended.
                </p>
              </>
            )}

            <label className="flex items-start gap-2 mt-3 cursor-pointer">
              {/* UX: checking the box clears the stale "confirm first" error. */}
              <input
                type="checkbox"
                checked={rights}
                onChange={(e) => { setRights(e.target.checked); if (e.target.checked) setUploadError(null) }}
                className="mt-0.5"
              />
              <span className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                I confirm I have the right to use this person’s image and consent to it being animated by AI.
              </span>
            </label>
            {uploadError && <p className="text-xs mt-2 font-semibold" style={{ color: '#f87171' }} role="alert">⚠️ {uploadError}</p>}
          </section>

          {/* 1.5 · Realism — animate the REAL photo (max fidelity) vs put the
              person in a generated scene (more context, softer face on movement). */}
          {sourceKind === 'photo' && faceUrl && (
            <section className="neon-card p-5">
              <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted2)' }}>
                1.5 · Realism
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFidelity('real')}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-[12px] font-bold text-left"
                  style={{ background: fidelity === 'real' ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)', border: fidelity === 'real' ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)', color: fidelity === 'real' ? '#2997ff' : 'var(--muted2)', cursor: 'pointer' }}
                >
                  🎯 Max realism — animate my real photo
                </button>
                <button
                  type="button"
                  onClick={() => setFidelity('scene')}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-[12px] font-bold text-left"
                  style={{ background: fidelity === 'scene' ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)', border: fidelity === 'scene' ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)', color: fidelity === 'scene' ? '#2997ff' : 'var(--muted2)', cursor: 'pointer' }}
                >
                  🎬 Put me in a scene
                </button>
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>
                {fidelity === 'real'
                  ? 'Animates your REAL photo — looks exactly like you, no distortion when moving. For an even more lifelike result, use a short real VIDEO of the person (the “🎥 Video” source above).'
                  : 'Puts you in a described scene (great for Copa/stadium context), but the face can soften when the person moves.'}
              </p>
              {fidelity === 'scene' && (
                <>
                  <textarea
                    value={scenePrompt}
                    onChange={(e) => setScenePrompt(e.target.value)}
                    disabled={busy || sceneLoading}
                    maxLength={600}
                    rows={2}
                    placeholder={'e.g. wearing a Brazil national team jersey, in the middle of a packed World Cup stadium crowd, cinematic lighting'}
                    className="w-full rounded-xl px-3.5 py-3 text-sm leading-relaxed resize-none mt-2"
                    style={{ background: 'rgba(0,0,0,.3)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                  />
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleBuildScene}
                      disabled={sceneLoading || busy || !scenePrompt.trim()}
                      className="rounded-lg px-3 py-2 text-[12px] font-bold"
                      style={{ background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.45)', color: '#2997ff', cursor: sceneLoading || busy || !scenePrompt.trim() ? 'not-allowed' : 'pointer' }}
                    >
                      {sceneLoading ? '🎬 Building the scene…' : '🎬 Build the scene'}
                    </button>
                    {sceneImageUrl && (
                      <span className="text-[11px] font-bold" style={{ color: '#7cc0ff' }}>
                        ✓ Scene ready — preview on the right.{' '}
                        <button type="button" onClick={() => setSceneImageUrl(null)} className="underline" style={{ color: 'var(--muted2)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          use original photo
                        </button>
                      </span>
                    )}
                  </div>
                  {sceneError && <p className="text-xs mt-2 font-semibold" style={{ color: '#f87171' }}>{sceneError}</p>}
                </>
              )}
            </section>
          )}

          {/* 2 · Script */}
          <section className="neon-card p-5">
            <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted2)' }}>2 · What they say</h2>
            {/* Idioma da narração (13/06) */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest mr-1" style={{ color: 'var(--muted)' }}>Language</span>
              {([['en', '🇺🇸 EN'], ['pt', '🇧🇷 PT'], ['es', '🇪🇸 ES']] as const).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  disabled={busy}
                  onClick={() => setLanguage(code)}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-bold"
                  style={{
                    background: language === code ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: language === code ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)',
                    color: language === code ? '#2997ff' : 'var(--muted2)',
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Verbatim fix (13/06) — explicit control over expansion. */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => { userPickedModeRef.current = true; setScriptMode('verbatim') }}
                className="rounded-lg px-3 py-1.5 text-[11px] font-bold"
                style={{
                  background: scriptMode === 'verbatim' ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: scriptMode === 'verbatim' ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)',
                  color: scriptMode === 'verbatim' ? '#2997ff' : 'var(--muted2)',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                ✍️ Say exactly this — word for word
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => { userPickedModeRef.current = true; setScriptMode('expand') }}
                className="rounded-lg px-3 py-1.5 text-[11px] font-bold"
                style={{
                  background: scriptMode === 'expand' ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: scriptMode === 'expand' ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)',
                  color: scriptMode === 'expand' ? '#2997ff' : 'var(--muted2)',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                ✨ Expand into a full Short script (45–60s)
              </button>
            </div>
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
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
              {scriptMode === 'verbatim'
                ? `Spoken word for word — nothing added. ~${requestDuration}s of video.`
                : 'AI builds a full 45–60s script around your idea (hook, build, payoff).'}
            </p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button
                type="button"
                onClick={handleVoicePreview}
                disabled={voiceLoading || busy}
                className="rounded-lg px-3 py-1.5 text-[12px] font-bold"
                style={{ background: 'rgba(41,151,255,0.08)', border: '1px solid rgba(41,151,255,0.3)', color: '#2997ff', cursor: voiceLoading || busy ? 'not-allowed' : 'pointer' }}
              >
                {voiceLoading ? '🎙️ Generating…' : '🔊 Preview the voice — free'}
              </button>
              {voiceUrl && <audio controls autoPlay src={voiceUrl} style={{ height: 30, maxWidth: 260 }} />}
            </div>
            {voiceError && <p className="text-xs mt-2 font-semibold" style={{ color: '#f87171' }}>{voiceError}</p>}
          </section>

          {/* 2.5 · Voice (optional) — clone the user's voice */}
          <section className="neon-card p-5">
            <h2 className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)' }}>
              2.5 · Speak in your own voice <span style={{ color: '#2997ff' }}>(optional)</span>
            </h2>
            <p className="text-[11px] mb-3" style={{ color: 'var(--muted)' }}>
              Upload a clear ~30-60s voice sample (one speaker, little background noise) and the narration will be spoken in that voice. Only use a voice you have the right to use.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => voiceInputRef.current?.click()}
                disabled={busy || voiceCloning || recording}
                className="rounded-lg px-3 py-2 text-[12px] font-bold"
                style={{ background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.45)', color: '#2997ff', cursor: busy || voiceCloning || recording ? 'not-allowed' : 'pointer' }}
              >
                {voiceCloning ? '🎙️ Cloning the voice…' : voiceId ? '🎙️ Upload a different sample' : '🎙️ Upload a voice sample'}
              </button>
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={busy || voiceCloning}
                className="rounded-lg px-3 py-2 text-[12px] font-bold"
                style={{ background: recording ? 'rgba(239,68,68,0.15)' : 'rgba(41,151,255,0.10)', border: recording ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(41,151,255,0.4)', color: recording ? '#fca5a5' : '#2997ff', cursor: busy || voiceCloning ? 'not-allowed' : 'pointer' }}
              >
                {recording ? '⏹ Stop & clone' : '🔴 Record a sample'}
              </button>
            </div>
            <input
              ref={voiceInputRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg"
              className="hidden"
              onChange={(e) => handleVoiceClone(e.target.files?.[0] ?? null)}
            />
            {voiceId && (
              <p className="text-[11px] mt-2 font-bold" style={{ color: '#7cc0ff' }}>
                ✓ Voice cloned — the narration will speak in this voice.{' '}
                <button type="button" onClick={() => setVoiceId(null)} className="underline" style={{ color: 'var(--muted2)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  use a default voice
                </button>
              </p>
            )}
            {voiceCloneError && <p className="text-xs mt-2 font-semibold" style={{ color: '#f87171' }}>{voiceCloneError}</p>}
          </section>

          {/* 3 · Style (photo sources only — video is always full lipsync) */}
          {sourceKind === 'photo' && (
            <section className="neon-card p-5">
              <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted2)' }}>3 · How it looks</h2>
              {scriptMode === 'verbatim' && (
                <p className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>
                  Word-for-word videos always show your face the whole time (they’re short — no b-roll needed).
                </p>
              )}
              <div className="flex flex-wrap gap-2" style={{ display: scriptMode === 'verbatim' ? 'none' : undefined }}>
                <button
                  type="button"
                  onClick={() => setHookMode(true)}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-[12px] font-bold"
                  style={{ background: hookMode ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)', border: hookMode ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)', color: hookMode ? '#2997ff' : 'var(--muted2)', cursor: 'pointer' }}
                >
                  ⚡ Hook intro — you open, b-roll tells the story
                </button>
                <button
                  type="button"
                  onClick={() => setHookMode(false)}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-[12px] font-bold"
                  style={{ background: !hookMode ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)', border: !hookMode ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)', color: !hookMode ? '#2997ff' : 'var(--muted2)', cursor: 'pointer' }}
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
                  style={{ background: engine === 'fabric' ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)', border: engine === 'fabric' ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)', color: engine === 'fabric' ? '#2997ff' : 'var(--muted2)', cursor: 'pointer' }}
                >
                  🎙️ Standard — talking head
                </button>
                <button
                  type="button"
                  onClick={() => setEngine('omnihuman')}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-[12px] font-bold"
                  style={{ background: engine === 'omnihuman' ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)', border: engine === 'omnihuman' ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)', color: engine === 'omnihuman' ? '#2997ff' : 'var(--muted2)', cursor: 'pointer' }}
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
              {/* KINEO-AVATAR-120-2026-07-06 — 120 universal credits per avatar video */}
              {AVATAR_COST} credits · debited only on success ·{' '}
              <span style={{ color: (avatarCredits ?? 0) >= AVATAR_COST ? '#2997ff' : '#f87171', fontWeight: 700 }}>
                you have {avatarCredits === null ? '—' : avatarCredits}
              </span>
              {(avatarCredits ?? AVATAR_COST) < AVATAR_COST && (
                <>
                  {' '}· <Link href="/pricing" style={{ color: '#2997ff' }}>get credits from $4.90</Link>
                </>
              )}
            </p>
            {!isLoggedIn && (
              <p className="text-[12px] text-center" style={{ color: 'var(--muted2)' }}>
                <Link href="/login?redirect=/avatar" style={{ color: '#2997ff', fontWeight: 700 }}>Sign in</Link> to create your avatar video.
              </p>
            )}
            {error && <p className="text-sm font-semibold rounded-xl px-4 py-3" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }} role="alert">⚠️ {error}</p>}
          </section>
        </div>

        {/* ── RIGHT: live phone preview + status ── */}
        <div className="hidden lg:flex flex-col items-center gap-4 sticky top-20">
          <div
            style={{
              width: 340, height: 710, borderRadius: 46, padding: 11,
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
                    <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #2997ff, #5cb3ff)', transition: 'width 0.6s ease' }} />
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
              style={{ textDecoration: 'none', maxWidth: 340 }}
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
