'use client'

import { ShortVideo } from '@/lib/openai'
import CopyButton from './CopyButton'

interface ResultCardProps {
  video: ShortVideo
  index: number
}

export default function ResultCard({ video, index }: ResultCardProps) {
  const allContent = `TITLE:\n${video.title}\n\nSCRIPT:\n${video.script}\n\nVIDEO PROMPT:\n${video.videoPrompt}\n\nHASHTAGS:\n${video.hashtags.join(' ')}\n\nYOUTUBE DESCRIPTION:\n${video.youtubeDescription}`

  return (
    <div
      className="rounded-[18px] overflow-hidden transition-all"
      style={{
        background: 'rgba(15,15,30,0.7)',
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        border: '1px solid rgba(99,102,241,0.12)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(99,102,241,.3)'
        el.style.boxShadow = '0 8px 40px rgba(99,102,241,.1)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(99,102,241,0.12)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-3.5 flex items-center justify-between flex-wrap gap-3"
        style={{
          background: 'rgba(0,0,0,.28)',
          borderBottom: '1px solid rgba(99,102,241,0.1)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,.18), rgba(124,58,237,.12))',
              border: '1px solid rgba(99,102,241,.22)',
              color: 'var(--indigo-light)',
            }}
          >
            {index + 1}
          </div>
          <span
            className="text-xs font-semibold tracking-wide"
            style={{ color: 'var(--muted2)' }}
          >
            Short #{index + 1}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={allContent} label="Copy All" variant="default" />
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-4">
        {/* Title */}
        <div>
          <div
            className="flex items-center justify-between mb-2"
          >
            <span
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: 'var(--muted2)' }}
            >
              🎬 Title
            </span>
            <CopyButton text={video.title} variant="small" />
          </div>
          <div
            className="rounded-[10px] px-3.5 py-3 text-sm font-bold leading-snug"
            style={{
              background: 'rgba(0,0,0,.2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            {video.title}
          </div>
        </div>

        {/* Script */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: 'var(--muted2)' }}
            >
              📝 30-Second Script
            </span>
            <CopyButton text={video.script} variant="small" />
          </div>
          <div
            className="rounded-[10px] px-3.5 py-3 text-sm leading-loose whitespace-pre-line"
            style={{
              background: 'rgba(0,0,0,.2)',
              border: '1px solid var(--border)',
              color: 'var(--muted2)',
            }}
          >
            {video.script}
          </div>
        </div>

        {/* Video Prompt */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: 'var(--muted2)' }}
            >
              🎥 Video Prompt
            </span>
            <CopyButton text={video.videoPrompt} variant="small" />
          </div>
          <div
            className="rounded-[10px] px-3.5 py-3 text-sm leading-relaxed"
            style={{
              background: 'rgba(0,0,0,.2)',
              border: '1px solid var(--border)',
              color: 'var(--muted2)',
            }}
          >
            {video.videoPrompt}
          </div>
        </div>

        {/* Hashtags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: 'var(--muted2)' }}
            >
              # Hashtags
            </span>
            <CopyButton text={video.hashtags.join(' ')} variant="small" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {video.hashtags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 rounded-md text-xs font-medium"
                style={{
                  background: 'rgba(99,102,241,.07)',
                  border: '1px solid rgba(99,102,241,.14)',
                  color: 'var(--indigo-light)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* YouTube Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: 'var(--muted2)' }}
            >
              📺 YouTube Description
            </span>
            <CopyButton text={video.youtubeDescription} variant="small" />
          </div>
          <div
            className="rounded-[10px] px-3.5 py-3 text-sm leading-relaxed"
            style={{
              background: 'rgba(0,0,0,.2)',
              border: '1px solid var(--border)',
              color: 'var(--muted2)',
            }}
          >
            {video.youtubeDescription}
          </div>
        </div>

        {/* Copy All Primary Button */}
        <CopyButton text={allContent} label="Copy Complete Script Package" variant="primary" />
      </div>
    </div>
  )
}
