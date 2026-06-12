'use client'

import { useState, useCallback } from 'react'
import type { BrollPlan, BrollScene, GlobalVisualStyle, VisualSource } from '@/lib/broll/types'
import { addToHistory, undoScene, initHistory, type SceneHistory } from '@/lib/broll/scene-history'
import SceneCard from './SceneCard'

interface VisualDirectorProps {
  plan: BrollPlan
  onSceneUpdate: (sceneNumber: number, instruction?: string) => void
  onRegenerateAll: () => void
  onApprove: (plan: BrollPlan) => void
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
  luxurious:  'rgba(16,185,129,0.2)',
  mysterious: 'rgba(20,184,166,0.2)',
  futuristic: 'rgba(6,182,212,0.2)',
  emotional:  'rgba(163,230,53,0.2)',
  tense:      'rgba(249,115,22,0.2)',
  epic:       'rgba(16,185,129,0.2)',
}

const MOOD_TEXT_COLORS: Record<string, string> = {
  dark:       'rgb(252,165,165)',
  energetic:  'rgb(253,224,71)',
  luxurious:  'rgb(216,180,254)',
  mysterious: 'rgb(165,180,252)',
  futuristic: 'rgb(103,232,249)',
  emotional:  'rgb(249,168,212)',
  tense:      'rgb(253,186,116)',
  epic:       'rgb(110,231,183)',
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

function StatChip({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '6px 14px',
        minWidth: 72,
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 800, color: color ?? 'rgba(255,255,255,0.9)' }}>
        {value}
      </span>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
  )
}

export default function VisualDirector({
  plan,
  onSceneUpdate,
  onRegenerateAll,
  onApprove,
  isLoading = false,
}: VisualDirectorProps) {
  const { globalStyle, scenes, niche, tone, totalDuration } = plan

  // Phase 3 — local scene state so undo/edits reflect immediately without a
  // round-trip to the parent. Parent's onSceneUpdate is still called for
  // actual regeneration requests.
  const [localScenes, setLocalScenes] = useState<BrollScene[]>(scenes)
  const [history, setHistory] = useState<SceneHistory>(() => initHistory(scenes))

  const moodBg = MOOD_COLORS[globalStyle.mood] ?? 'rgba(16,185,129,0.15)'
  const moodText = MOOD_TEXT_COLORS[globalStyle.mood] ?? 'rgb(110,231,183)'

  // Derived stats
  const avgRelevance = localScenes.some((s) => s.relevanceScore !== undefined)
    ? Math.round(
        localScenes
          .filter((s) => s.relevanceScore !== undefined)
          .reduce((sum, s) => sum + (s.relevanceScore ?? 0), 0) /
          localScenes.filter((s) => s.relevanceScore !== undefined).length,
      )
    : null

  const sourceCounts = localScenes.reduce<Record<VisualSource, number>>(
    (acc, s) => { acc[s.source] = (acc[s.source] ?? 0) + 1; return acc },
    { pexels: 0, stock: 0, ai: 0 },
  )

  const handleUndo = useCallback((sceneNumber: number) => {
    const { scene: prev, newHistory } = undoScene(history, sceneNumber)
    if (!prev) return
    setLocalScenes((current) =>
      current.map((s) => (s.sceneNumber === sceneNumber ? prev : s)),
    )
    setHistory(newHistory)
  }, [history])

  const handleSceneRegenerate = useCallback((sceneNumber: number, instruction?: string) => {
    // Save current version to history before requesting a regeneration
    const current = localScenes.find((s) => s.sceneNumber === sceneNumber)
    if (current) {
      setHistory((h) => addToHistory(h, current))
    }
    onSceneUpdate(sceneNumber, instruction)
  }, [localScenes, onSceneUpdate])

  const handleApprove = useCallback(() => {
    onApprove({ ...plan, scenes: localScenes })
  }, [plan, localScenes, onApprove])

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
            border: '3px solid rgba(16,185,129,0.2)',
            borderTopColor: 'rgb(16,185,129)',
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
      {/* Stats bar — scene count, duration, avg relevance, source breakdown */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: '14px 18px',
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
        }}
      >
        <StatChip label="Scenes" value={localScenes.length} color="rgba(110,231,183,0.9)" />
        <StatChip label="Duration" value={`${totalDuration}s`} color="rgba(167,243,208,0.9)" />
        {avgRelevance !== null && (
          <StatChip
            label="Avg Relevance"
            value={`${avgRelevance}%`}
            color={avgRelevance >= 75 ? '#22c55e' : avgRelevance >= 55 ? '#eab308' : '#ef4444'}
          />
        )}
        {sourceCounts.pexels > 0 && (
          <StatChip label="Pexels" value={sourceCounts.pexels} color="rgba(251,191,36,0.9)" />
        )}
        {sourceCounts.ai > 0 && (
          <StatChip label="AI Gen" value={sourceCounts.ai} color="rgba(110,231,183,0.9)" />
        )}
        {sourceCounts.stock > 0 && (
          <StatChip label="Stock" value={sourceCounts.stock} color="rgba(148,163,184,0.9)" />
        )}
      </div>

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
              {localScenes.length} scenes &middot; {totalDuration}s &middot; {niche} &middot; {tone}
            </p>
          </div>

          <button
            onClick={onRegenerateAll}
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 10,
              border: '1px solid rgba(16,185,129,0.5)',
              background: 'rgba(16,185,129,0.15)',
              color: 'rgba(110,231,183,0.95)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(16,185,129,0.28)'
              e.currentTarget.style.borderColor = 'rgba(16,185,129,0.8)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(16,185,129,0.15)'
              e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'
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
        {localScenes.map((scene, i) => (
          <SceneCard
            key={scene.sceneNumber}
            scene={scene}
            index={i}
            onRegenerate={handleSceneRegenerate}
            onPromptEdit={(sceneNumber, newPrompt) => {
              // Update local scene state with the edited prompt
              setLocalScenes((current) =>
                current.map((s) =>
                  s.sceneNumber === sceneNumber ? { ...s, brollPrompt: newPrompt } : s,
                ),
              )
            }}
            historyCount={(history.get(scene.sceneNumber) ?? []).length}
            onUndo={handleUndo}
          />
        ))}
      </div>

      {/* Approve & Generate button — prominently at bottom */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 8,
          paddingBottom: 16,
        }}
      >
        <button
          onClick={handleApprove}
          style={{
            padding: '16px 48px',
            fontSize: 16,
            fontWeight: 800,
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(34,197,94,0.35)',
            transition: 'all 0.2s ease',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(34,197,94,0.45)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(34,197,94,0.35)'
          }}
        >
          ✅ Approve & Generate Video
        </button>
      </div>
    </div>
  )
}
