'use client'

import { useRef, useState } from 'react'
import type { BrollScene, ScenePurpose, VisualMood, ShotType, VisualSource } from '@/lib/broll/types'

interface SceneCardProps {
  scene: BrollScene
  index: number
  onRegenerate: (sceneNumber: number, instruction?: string) => void
  onPromptEdit: (sceneNumber: number, newPrompt: string) => void
  isRegenerating?: boolean
}

const PURPOSE_BADGE: Record<ScenePurpose, { label: string; className: string }> = {
  hook:        { label: 'HOOK',        className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  payoff:      { label: 'PAYOFF',      className: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  escalation:  { label: 'ESCALATION', className: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
  explanation: { label: 'EXPLAIN',    className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  transition:  { label: 'TRANSITION', className: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
}

const MOOD_BADGE: Record<VisualMood, string> = {
  dark:        'Dark',
  energetic:   'Energetic',
  luxurious:   'Luxurious',
  mysterious:  'Mysterious',
  futuristic:  'Futuristic',
  emotional:   'Emotional',
  tense:       'Tense',
  epic:        'Epic',
}

const SHOT_LABEL: Record<ShotType, string> = {
  close_up:       'Close Up',
  drone:          'Drone',
  tracking:       'Tracking',
  handheld:       'Handheld',
  pov:            'POV',
  wide:           'Wide',
  macro:          'Macro',
  cinematic_zoom: 'Cinematic Zoom',
}

const SOURCE_BADGE: Record<VisualSource, { label: string; className: string }> = {
  pexels: { label: 'Pexels',  className: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  ai:     { label: 'AI Gen',  className: 'bg-violet-500/20 text-violet-400 border border-violet-500/30' },
  stock:  { label: 'Stock',   className: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
}

function RelevanceDot({ score }: { score: number }) {
  const color =
    score >= 80
      ? '#22c55e' // green-500
      : score >= 60
      ? '#eab308' // yellow-500
      : '#ef4444' // red-500

  return (
    <span
      title={`Relevance: ${score}%`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        color,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
        }}
      />
      {score}%
    </span>
  )
}

export default function SceneCard({
  scene,
  index,
  onRegenerate,
  onPromptEdit,
  isRegenerating = false,
}: SceneCardProps) {
  const [editedPrompt, setEditedPrompt] = useState(scene.brollPrompt)
  const [customInstruction, setCustomInstruction] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const purposeBadge = PURPOSE_BADGE[scene.scenePurpose]
  const sourceBadge = SOURCE_BADGE[scene.source]
  const relevance = scene.relevanceScore ?? 70

  function handleBlur() {
    if (editedPrompt !== scene.brollPrompt) {
      onPromptEdit(scene.sceneNumber, editedPrompt)
    }
  }

  function handleRegenerate(instruction?: string) {
    onRegenerate(scene.sceneNumber, instruction)
  }

  return (
    <div
      style={{
        background: 'rgba(17, 24, 39, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        opacity: isRegenerating ? 0.6 : 1,
        transition: 'opacity 0.2s ease',
        position: 'relative',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Scene number */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            minWidth: 28,
          }}
        >
          #{index + 1}
        </span>

        {/* Purpose badge */}
        <span
          className={purposeBadge.className}
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '2px 8px',
            borderRadius: 6,
          }}
        >
          {purposeBadge.label}
        </span>

        {/* Duration */}
        <span
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
            marginLeft: 2,
          }}
        >
          {scene.durationSeconds}s
        </span>

        {/* Relevance score */}
        {scene.relevanceScore !== undefined && (
          <span style={{ marginLeft: 'auto' }}>
            <RelevanceDot score={relevance} />
          </span>
        )}
      </div>

      {/* Caption */}
      <p
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.9)',
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {scene.caption}
      </p>

      {/* Narration */}
      <p
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.45)',
          margin: 0,
          lineHeight: 1.6,
          borderLeft: '2px solid rgba(255,255,255,0.1)',
          paddingLeft: 10,
          fontStyle: 'italic',
        }}
      >
        {scene.narration.length > 140 ? scene.narration.slice(0, 140) + '…' : scene.narration}
      </p>

      {/* Visual intent */}
      {scene.visualIntent && (
        <p
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.55)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {scene.visualIntent}
        </p>
      )}

      {/* Mood / Shot / Source chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {/* Mood */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 6,
            letterSpacing: '0.06em',
          }}
          className="bg-purple-500/20 text-purple-400 border border-purple-500/30"
        >
          {MOOD_BADGE[scene.visualMood]}
        </span>

        {/* Shot type */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 6,
            letterSpacing: '0.06em',
          }}
          className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
        >
          {SHOT_LABEL[scene.shotType]}
        </span>

        {/* Source */}
        <span
          className={sourceBadge.className}
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 6,
            letterSpacing: '0.06em',
          }}
        >
          {sourceBadge.label}
        </span>
      </div>

      {/* Pexels query */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Search:
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'rgba(251,191,36,0.8)',
            background: 'rgba(251,191,36,0.08)',
            padding: '1px 8px',
            borderRadius: 4,
            fontFamily: 'monospace',
          }}
        >
          {scene.pexelsQuery}
        </span>
      </div>

      {/* B-roll prompt textarea */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          B-roll Prompt
        </label>
        <textarea
          ref={textareaRef}
          value={editedPrompt}
          onChange={(e) => setEditedPrompt(e.target.value)}
          onBlur={handleBlur}
          rows={3}
          disabled={isRegenerating}
          style={{
            width: '100%',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'
          }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => handleRegenerate()}
          disabled={isRegenerating}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: '1px solid rgba(59,130,246,0.4)',
            background: 'rgba(59,130,246,0.12)',
            color: 'rgba(147,197,253,0.9)',
            cursor: isRegenerating ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isRegenerating) {
              e.currentTarget.style.background = 'rgba(59,130,246,0.22)'
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.7)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.12)'
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'
          }}
        >
          {isRegenerating ? 'Regenerating...' : 'Regenerate'}
        </button>

        <button
          onClick={() => handleRegenerate('Make this more cinematic — darker lighting, dramatic camera movement, high contrast, film-noir feel')}
          disabled={isRegenerating}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: '1px solid rgba(139,92,246,0.4)',
            background: 'rgba(139,92,246,0.12)',
            color: 'rgba(196,181,253,0.9)',
            cursor: isRegenerating ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isRegenerating) {
              e.currentTarget.style.background = 'rgba(139,92,246,0.22)'
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.7)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(139,92,246,0.12)'
            e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'
          }}
        >
          More Cinematic
        </button>

        <button
          onClick={() => handleRegenerate('Make this more realistic — documentary feel, natural lighting, real-world footage, authentic subjects')}
          disabled={isRegenerating}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: '1px solid rgba(34,197,94,0.4)',
            background: 'rgba(34,197,94,0.12)',
            color: 'rgba(134,239,172,0.9)',
            cursor: isRegenerating ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isRegenerating) {
              e.currentTarget.style.background = 'rgba(34,197,94,0.22)'
              e.currentTarget.style.borderColor = 'rgba(34,197,94,0.7)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(34,197,94,0.12)'
            e.currentTarget.style.borderColor = 'rgba(34,197,94,0.4)'
          }}
        >
          More Realistic
        </button>
      </div>

      {/* Custom instruction toggle */}
      <div>
        <button
          onClick={() => setShowCustom(!showCustom)}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 11,
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          {showCustom ? 'Hide custom instruction' : '+ Custom instruction'}
        </button>

        {showCustom && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="text"
              placeholder="e.g. Use aerial drone shot of Manhattan at night..."
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                color: 'rgba(255,255,255,0.75)',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customInstruction.trim()) {
                  handleRegenerate(customInstruction.trim())
                  setCustomInstruction('')
                  setShowCustom(false)
                }
              }}
            />
            <button
              onClick={() => {
                if (customInstruction.trim()) {
                  handleRegenerate(customInstruction.trim())
                  setCustomInstruction('')
                  setShowCustom(false)
                }
              }}
              disabled={!customInstruction.trim() || isRegenerating}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: '1px solid rgba(59,130,246,0.4)',
                background: 'rgba(59,130,246,0.2)',
                color: 'rgba(147,197,253,0.9)',
                cursor: !customInstruction.trim() || isRegenerating ? 'not-allowed' : 'pointer',
              }}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Regenerating overlay */}
      {isRegenerating && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            Regenerating...
          </span>
        </div>
      )}
    </div>
  )
}
