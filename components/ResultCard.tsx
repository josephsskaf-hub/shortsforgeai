'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShortVideo } from '@/lib/openai'
import CopyButton from './CopyButton'
import { ViralScore } from './ViralScore'

interface ResultCardProps {
  video: ShortVideo
  index: number
  total?: number
  niche?: string
}

// Extract hook text from "🎯 HOOK: ..." section of script
function extractHook(script: string): string | null {
  const match = script.match(/🎯\s*HOOK[:\s]+([^\n]+(?:\n(?!📝|🔗)[^\n]+)*)/i)
  if (match) return match[1].trim()
  // Fallback: first line of script
  const firstLine = script.split('\n').find(l => l.trim().length > 0)
  return firstLine || null
}

export default function ResultCard({ video, index, total = 5, niche }: ResultCardProps) {
  const router = useRouter()
  const [scriptExpanded, setScriptExpanded] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const hook = extractHook(video.script)

  function handleCreateVideo() {
    const params = new URLSearchParams({
      hook: hook ?? '',
      title: video.title,
      script: video.script,
      ...(niche ? { niche } : {}),
    })
    router.push(`/video?${params.toString()}`)
  }

  // Clean copy format
  const copyText = [
    `HOOK: ${hook ?? ''}`,
    `TITLE: ${video.title}`,
    `SCRIPT:\n${video.script}`,
    `HASHTAGS: ${video.hashtags.join(' ')}`,
  ].join('\n\n')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyText)
    } catch {
      const el = document.createElement('textarea')
      el.value = copyText
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="rounded-[20px] overflow-hidden transition-all duration-300"
      style={{
        background: 'rgba(11,17,32,0.85)',
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        border: '1px solid rgba(16, 185, 129,0.16)',
        boxShadow: '0 4px 24px rgba(0,0,0,.25)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(16, 185, 129,.38)'
        el.style.boxShadow = '0 12px 48px rgba(16, 185, 129,.13)'
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(16, 185, 129,0.16)'
        el.style.boxShadow = '0 4px 24px rgba(0,0,0,.25)'
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* ─── Header ─── */}
      <div
        className="px-5 py-4 flex items-center justify-between flex-wrap gap-3"
        style={{
          background: 'linear-gradient(90deg, rgba(16, 185, 129,.09), rgba(5, 150, 105,.05))',
          borderBottom: '1px solid rgba(16, 185, 129,0.14)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Number badge */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129,.3), rgba(5, 150, 105,.2))',
              border: '1px solid rgba(16, 185, 129,.35)',
              color: 'var(--indigo-light)',
              fontSize: '1rem',
            }}
          >
            {index + 1}
          </div>
          <div>
            <div
              className="font-black tracking-tight"
              style={{ color: 'var(--text)', fontSize: '0.95rem' }}
            >
              Script {index + 1} of {total}
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

        {/* Per-card Copy button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all"
          style={{
            background: copied ? 'rgba(16,185,129,.1)' : 'rgba(16, 185, 129,.1)',
            border: copied ? '1px solid rgba(16,185,129,.28)' : '1px solid rgba(16, 185, 129,.25)',
            color: copied ? '#34d399' : 'var(--indigo-light)',
            cursor: 'pointer',
          }}
        >
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>

      {/* ─── Body ─── */}
      <div className="p-5 flex flex-col gap-5">

        {/* 🪝 Hook */}
        {hook && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--indigo-light)' }}
              >
                🪝 Hook
              </span>
              <CopyButton text={hook} variant="small" />
            </div>
            <div
              className="rounded-[12px] px-4 py-3.5"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129,.09), rgba(5, 150, 105,.05))',
                border: '1px solid rgba(16, 185, 129,.2)',
                borderLeft: '3px solid var(--indigo-light)',
              }}
            >
              <p
                className="font-black leading-snug"
                style={{ color: 'var(--text)', fontSize: '1rem', fontStyle: 'italic' }}
              >
                {hook}
              </p>
            </div>
          </div>
        )}

        <div style={{ height: 1, background: 'rgba(16, 185, 129,.08)', borderRadius: 1 }} />

        {/* 📌 Title */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              📌 Title
            </span>
            <CopyButton text={video.title} variant="small" />
          </div>
          <div
            className="rounded-[10px] px-4 py-3 text-sm font-bold leading-snug"
            style={{ background: 'rgba(0,0,0,.22)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            {video.title}
          </div>
        </div>

        {/* 📊 Viral Scores */}
        <ViralScore hook={hook ?? ''} title={video.title} script={video.script} />

        <div style={{ height: 1, background: 'rgba(16, 185, 129,.08)', borderRadius: 1 }} />

        {/* 📝 Script — expandable */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              📝 Script
            </span>
            <div className="flex items-center gap-2">
              <CopyButton text={video.script} variant="small" />
              <button
                onClick={() => setScriptExpanded(!scriptExpanded)}
                className="text-xs font-semibold px-2 py-1 rounded transition-all"
                style={{
                  background: 'rgba(16, 185, 129,.07)',
                  border: '1px solid rgba(16, 185, 129,.14)',
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

        <div style={{ height: 1, background: 'rgba(16, 185, 129,.08)', borderRadius: 1 }} />

        {/* #️⃣ Hashtags — chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              #️⃣ Hashtags
            </span>
            <CopyButton text={video.hashtags.join(' ')} variant="small" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {video.hashtags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-default"
                style={{
                  background: 'rgba(16, 185, 129,.08)',
                  border: '1px solid rgba(16, 185, 129,.18)',
                  color: 'var(--indigo-light)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(16, 185, 129,.08)', borderRadius: 1 }} />

        {/* 🎥 Video Prompt */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              🎥 Video Prompt
            </span>
            <CopyButton text={video.videoPrompt} variant="small" />
          </div>
          <div
            className="rounded-[10px] px-4 py-3 text-sm leading-relaxed"
            style={{ background: 'rgba(0,0,0,.22)', border: '1px solid var(--border)', color: 'var(--muted2)' }}
          >
            {video.videoPrompt}
          </div>
        </div>

        {/* 📺 YouTube Description — expandable */}
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
                  background: 'rgba(16, 185, 129,.07)',
                  border: '1px solid rgba(16, 185, 129,.14)',
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

        {/* Bottom primary CTAs */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1">
            <CopyButton text={copyText} label="Copy Complete Script Package" variant="primary" />
          </div>
          <button
            onClick={handleCreateVideo}
            className="flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-all sm:flex-1"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 211, 238,.18), rgba(5, 150, 105,.10))',
              border: '1px solid rgba(34, 211, 238,.45)',
              color: '#22D3EE',
              minHeight: 44,
              cursor: 'pointer',
              boxShadow: '0 0 0 0 rgba(34, 211, 238,.35)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'linear-gradient(135deg, rgba(34, 211, 238,.30), rgba(5, 150, 105,.18))'
              el.style.borderColor = 'rgba(34, 211, 238,.7)'
              el.style.boxShadow = '0 0 16px rgba(34, 211, 238,.35)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'linear-gradient(135deg, rgba(34, 211, 238,.18), rgba(5, 150, 105,.10))'
              el.style.borderColor = 'rgba(34, 211, 238,.45)'
              el.style.boxShadow = '0 0 0 0 rgba(34, 211, 238,.35)'
            }}
          >
            🎬 Create Video →
          </button>
        </div>
      </div>
    </div>
  )
}
