'use client'

import type { BrollPlan, GlobalVisualStyle } from '@/lib/broll/types'
import SceneCard from './SceneCard'

interface VisualDirectorProps {
  plan: BrollPlan
  onSceneUpdate: (sceneNumber: number, instruction?: string) => void
  onRegenerateAll: () => void
  isLoading?: boolean
}

const PACING_LABEL: Record<GlobalVisualStyle['pacing'], string> = {
  slow:       'Slow',
  medium:     'Medium',
  fast:       'Fast',
  ultra_fast: 'Ultra Fast',
}

const MOOD_COLORS: Record<string, string> = {
  dark:       'rgba(239,68,68,0.2)',
  energetic:  'rgba(234,179,8,0.2)',
  luxurious:  'rgba(168,85,247,0.2)',
  mysterious: 'rgba(99,102,241,0.2)',
  futuristic: 'rgba(6,182,212,0.2)',
  emotional:  'rgba(236,72,153,0.2)',
  tense:      'rgba(249,115,22,0.2)',
  epic:       'rgba(59,130,246,0.2)',
}

const MOOD_TEXT_COLORS: Record<string, string> = {
  dark:       'rgb(252,165,165)',
  energetic:  'rgb(253,224,71)',
  luxurious:  'rgb(216,180,254)',
  mysterious: 'rgb(165,180,252)',
  futuristic: 'rgb(103,232,249)',
  emotional:  'rgb(249,168,212)',
  tense:      'rgb(253,186,116)',
  epic:       'rgb(147,197,253)',
}

function GlobalStyleChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '8px 14px',
      }}
    >
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )
}

export default function VisualDirector({
  plan,
  onSceneUpdate,
  onRegenerateAll,
  isLoading = false,
}: VisualDirectorProps) {
  const { globalStyle, scenes, niche, tone, totalDuration } = plan

  const moodBg = MOOD_COLORS[globalStyle.mood] ?? 'rgba(59,130,246,0.15)'
  const moodText = MOOD_TEXT_COLORS[globalStyle.mood] ?? 'rgb(147,197,253)'

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
          gap: 16,
        }}
      >
        {/* Simple spinner */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '3px solid rgba(59,130,246,0.2)',
            borderTopColor: 'rgb(59,130,246)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          Visual Director is analyzing your script...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div
        style={{
          background: 'rgba(17,24,39,0.8)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.95)', margin: 0 }}>
              Visual Director
            </h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
              {scenes.length} scenes &middot; {totalDuration}s &middot; {niche} &middot; {tone}
            </p>
          </div>

          <button
            onClick={onRegenerateAll}
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 10,
              border: '1px solid rgba(59,130,246,0.5)',
              background: 'rgba(59,130,246,0.15)',
              color: 'rgba(147,197,253,0.95)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(59,130,246,0.28)'
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.8)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(59,130,246,0.15)'
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'
            }}
          >
            Regenerate All
          </button>
        </div>

        {/* Global style chips */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Mood chip — colored */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              background: moodBg,
              border: `1px solid ${moodText}30`,
              borderRadius: 10,
              padding: '8px 14px',
            }}
          >
            <span style={{ fontSize: 9, color: `${moodText}80`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Mood
            </span>
            <span style={{ fontSize: 13, color: moodText, fontWeight: 700, textTransform: 'capitalize' }}>
              {globalStyle.mood}
            </span>
          </div>

          <GlobalStyleChip label="Pacing" value={PACING_LABEL[globalStyle.pacing]} />
          <GlobalStyleChip label="Camera" value={globalStyle.cameraStyle.replace(/_/g, ' ')} />
          <GlobalStyleChip label="Lighting" value={globalStyle.lighting.replace(/_/g, ' ')} />
          <GlobalStyleChip label="Saturation" value={globalStyle.saturation} />
          <GlobalStyleChip
            label="Realism"
            value={`${Math.round(globalStyle.realism * 100)}%`}
          />
          <GlobalStyleChip label="Duration" value={`${totalDuration}s`} />
        </div>
      </div>

      {/* Scene grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        {scenes.map((scene, i) => (
          <SceneCard
            key={scene.sceneNumber}
            scene={scene}
            index={i}
            onRegenerate={onSceneUpdate}
            onPromptEdit={(sceneNumber, newPrompt) => {
              // Prompt edits are handled locally in SceneCard — parent can
              // listen here if it needs to persist the edit upstream
              console.log(`[VisualDirector] scene ${sceneNumber} prompt edited:`, newPrompt.slice(0, 60))
            }}
          />
        ))}
      </div>
    </div>
  )
}
