'use client'

import { useState } from 'react'
import { ShortVideo } from '@/lib/openai'
import CopyButton from './CopyButton'

interface ResultCardProps {
  video: ShortVideo
  index: number
}

// Extract hook text from "🎯 HOOK: ..." section of script
function extractHook(script: string): string | null {
  const match = script.match(/🎯\s*HOOK[:\s]+([^\n]+(?:\n(?!📝|🔗)[^\n]+)*)/i)
  if (match) return match[1].trim()
  // Fallback: first line of script
  const firstLine = script.split('\n').find(l => l.trim().length > 0)
  return firstLine || null
}

export default function ResultCard({ video, index }: ResultCardProps) {
  const [scriptExpanded, setScriptExpanded] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  const hook = extractHook(video.script)
  const allContent = `TITLE:\n${video.title}\n\nSCRIPT:\n${video.script}\n\nVIDEO PROMPT:\n${video.videoPrompt}\n\nHASHTAGS:\n${video.hashtags.join(' ')}\n\nYOUTUBE DESCRIPTION:\n${video.youtubeDescription}`

  return (
    <div
      className="rounded-[20px] overflow-hidden transition-all duration-300"
      style={{
        background: 'rgba(15,15,30,0.8)',
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        border: '1px solid rgba(99,102,241,0.14)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(99,102,241,.35)'
        el.style.boxShadow = '0 12px 48px rgba(99,102,241,.12)'
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(99,102,241,0.14)'
        el.style.boxShadow = 'none'
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* ─── Header ─── */}
      <div
        className="px-5 py-4 flex items-center justify-between flex-wrap gap-3"
        style={{
          background: 'linear-gradient(90deg, rgba(99,102,241,.07), rgba(124,58,237,.04))',
          borderBottom: '1px solid rgba(99,102,241,0.12)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,.25), rgba(124,58,237,.18))',
              border: '1px solid rgba(99,102,241,.3)',
              color: 'var(--indigo-light)',
              fontSize: '0.9rem',
            }}
          >
            {index + 1}
          </div>
          <div>
            <div
              className="font-black tracking-tight"
              style={{ color: 'var(--text)', fontSize: '0.92rem' }}
            >
              Short #{index + 1}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,.5)' }}
              />
              <span className="text-xs font-medium" style={{ color: '#34d399' }}>
                Ready to post
              </span>
            </div>
          </div>
        </div>
        <CopyButton text={allContent} label="Copy All" variant="default" />
      </div>

      {/* ─── Body ─── */}
      <div className="p-5 flex flex-col gap-5">

        {/* Hook — large, italic, bold highlighted */}
        {hook && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--indigo-light)' }}
              >
                🎣 Hook
              </span>
              <CopyButton text={hook} variant="small" />
            </div>
            <div
              className="rounded-[12px] px-4 py-3.5"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,.08), rgba(124,58,237,.05))',
                border: '1px solid rgba(99,102,241,.18)',
                borderLeft: '3px solid var(--indigo-light)',
              }}
            >
              <p
                className="font-black leading-snug"
                style={{
                  color: 'var(--text)',
                  fontSize: '1rem',
                  fontStyle: 'italic',
                }}
              >
                {hook}
              </p>
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              🎬 Title
            </span>
            <CopyButton text={video.title} variant="small" />
          </div>
          <div
            className="rounded-[10px] px-4 py-3 text-sm font-bold leading-snug"
            style={{
              background: 'rgba(0,0,0,.22)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            {video.title}
          </div>
        </div>

        {/* Script — expandable */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              📝 30-Second Script
            </span>
            <div className="flex items-center gap-2">
              <CopyButton text={video.script} variant="small" />
              <button
                onClick={() => setScriptExpanded(!scriptExpanded)}
                className="text-xs font-semibold px-2 py-1 rounded transition-all"
                style={{
                  background: 'rgba(99,102,241,.07)',
                  border: '1px solid rgba(99,102,241,.14)',
                  color: 'var(--indigo-light)',
                  cursor: 'pointer',
                }}
              >
                {scriptExpanded ? '▲ Less' : '▼ More'}
              </button>
            </div>
          </div>
          <div
            className="rounded-[10px] px-4 py-3 text-sm leading-loose whitespace-pre-line overflow-hidden transition-all duration-300"
            style={{
              background: 'rgba(0,0,0,.22)',
              border: '1px solid var(--border)',
              color: 'var(--muted2)',
              maxHeight: scriptExpanded ? 'none' : 96,
              maskImage: scriptExpanded ? 'none' : 'linear-gradient(to bottom, black 50%, transparent 100%)',
              WebkitMaskImage: scriptExpanded ? 'none' : 'linear-gradient(to bottom, black 50%, transparent 100%)',
            }}
          >
            {video.script}
          </div>
          {!scriptExpanded && (
            <button
              onClick={() => setScriptExpanded(true)}
              className="mt-1 text-xs font-semibold"
              style={{ color: 'var(--indigo-light)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Show full script ▼
            </button>
          )}
        </div>

        {/* Hashtags — chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              # Hashtags
            </span>
            <CopyButton text={video.hashtags.join(' ')} variant="small" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {video.hashtags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-default"
                style={{
                  background: 'rgba(99,102,241,.08)',
                  border: '1px solid rgba(99,102,241,.18)',
                  color: 'var(--indigo-light)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Video Prompt */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              🎥 Video Prompt
            </span>
            <CopyButton text={video.videoPrompt} variant="small" />
          </div>
          <div
            className="rounded-[10px] px-4 py-3 text-sm leading-relaxed"
            style={{
              background: 'rgba(0,0,0,.22)',
              border: '1px solid var(--border)',
              color: 'var(--muted2)',
            }}
          >
            {video.videoPrompt}
          </div>
        </div>

        {/* YouTube Description — expandable */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              📺 YouTube Description
            </span>
            <div className="flex items-center gap-2">
              <CopyButton text={video.youtubeDescription} variant="small" />
              <button
                onClick={() => setDescExpanded(!descExpanded)}
                className="text-xs font-semibold px-2 py-1 rounded transition-all"
                style={{
                  background: 'rgba(99,102,241,.07)',
                  border: '1px solid rgba(99,102,241,.14)',
                  color: 'var(--indigo-light)',
                  cursor: 'pointer',
                }}
              >
                {descExpanded ? '▲' : '▼'}
              </button>
            </div>
          </div>
          <div
            className="rounded-[10px] px-4 py-3 text-sm leading-relaxed overflow-hidden transition-all duration-300"
            style={{
              background: 'rgba(0,0,0,.22)',
              border: '1px solid var(--border)',
              color: 'var(--muted2)',
              maxHeight: descExpanded ? 'none' : 64,
              maskImage: descExpanded ? 'none' : 'linear-gradient(to bottom, black 40%, transparent 100%)',
              WebkitMaskImage: descExpanded ? 'none' : 'linear-gradient(to bottom, black 40%, transparent 100%)',
            }}
          >
            {video.youtubeDescription}
          </div>
          {!descExpanded && (
            <button
              onClick={() => setDescExpanded(true)}
              className="mt-1 text-xs font-semibold"
              style={{ color: 'var(--indigo-light)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Show full description ▼
            </button>
          )}
        </div>

        {/* Copy All — primary */}
        <CopyButton text={allContent} label="Copy Complete Script Package" variant="primary" />
      </div>
    </div>
  )
}
