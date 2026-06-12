'use client'

import type { BrollScene, VisualMood } from '@/lib/broll/types'

interface ScenePreviewProps {
  scene: BrollScene
  pexelsClip?: string // URL of a Pexels video clip if already fetched
}

const MOOD_GRADIENTS: Record<VisualMood, { from: string; to: string }> = {
  dark:       { from: '#0f172a', to: '#334155' }, // slate-900 → slate-700
  mysterious: { from: '#1e0033', to: '#1e1b4b' }, // purple-950 → indigo-900
  luxurious:  { from: '#2d1000', to: '#422006' }, // amber-950 → yellow-900
  energetic:  { from: '#431407', to: '#450a0a' }, // orange-900 → red-900
  futuristic: { from: '#083344', to: '#0c1a33' }, // cyan-950 → blue-900
  emotional:  { from: '#2d0020', to: '#340018' }, // pink-950 → rose-900
  tense:      { from: '#3b0000', to: '#431407' }, // red-950 → orange-900
  epic:       { from: '#1e1b4b', to: '#2e1065' }, // indigo-950 → violet-900
}

const MOOD_TEXT_COLORS: Record<VisualMood, string> = {
  dark:       'rgba(148,163,184,0.85)', // slate-400
  mysterious: 'rgba(110,231,183,0.85)', // violet-300
  luxurious:  'rgba(253,224,71,0.85)',  // yellow-300
  energetic:  'rgba(253,186,116,0.85)', // orange-300
  futuristic: 'rgba(103,232,249,0.85)', // cyan-300
  emotional:  'rgba(249,168,212,0.85)', // pink-300
  tense:      'rgba(252,165,165,0.85)', // red-300
  epic:       'rgba(52,211,153,0.85)', // emerald-400
}

export default function ScenePreview({ scene, pexelsClip }: ScenePreviewProps) {
  const gradient = MOOD_GRADIENTS[scene.visualMood] ?? MOOD_GRADIENTS.dark
  const textColor = MOOD_TEXT_COLORS[scene.visualMood] ?? 'rgba(148,163,184,0.85)'

  // 9:16 aspect — at 120px wide, height is ~213px; we cap at that.
  const width = 120
  const height = Math.round(width * (16 / 9))

  if (pexelsClip) {
    return (
      <div
        style={{
          width,
          height,
          borderRadius: 8,
          overflow: 'hidden',
          flexShrink: 0,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <video
          src={pexelsClip}
          muted
          loop
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }

  // Placeholder — gradient + truncated brollPrompt text
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        overflow: 'hidden',
        flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.1)',
        background: `linear-gradient(160deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '6px 5px',
        position: 'relative',
      }}
    >
      {/* Mood label at top */}
      <div
        style={{
          position: 'absolute',
          top: 5,
          left: 5,
          fontSize: 8,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: textColor,
          opacity: 0.7,
        }}
      >
        {scene.visualMood}
      </div>

      {/* Small camera icon placeholder */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -60%)',
          fontSize: 20,
          opacity: 0.35,
        }}
      >
        🎬
      </div>

      {/* Truncated prompt text at bottom */}
      <p
        style={{
          fontSize: 8,
          color: textColor,
          textAlign: 'center',
          lineHeight: 1.3,
          margin: 0,
          opacity: 0.8,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {scene.brollPrompt.length > 80 ? scene.brollPrompt.slice(0, 80) + '…' : scene.brollPrompt}
      </p>
    </div>
  )
}
